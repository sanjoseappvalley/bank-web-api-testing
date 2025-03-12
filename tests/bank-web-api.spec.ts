import { test, expect } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config(); // Load environment variables

const BASE_URL = 'https://hextrust.com';
const API_BASE_URL = process.env.API_BASE_URL!;
const USER_EMAIL = process.env.USER_EMAIL!;
const USER_PASSWORD = process.env.USER_PASSWORD!;

test.describe('Hex Trust E2E Test Suite', () => {
  test('Homepage & Navigation Test', async ({ page }) => {
    await page.goto(BASE_URL)

    await expect(page).toHaveTitle(/Hex Trust/i)

    const header = page.locator('h1');
    await expect(header).toBeVisible();

    await page.getByRole('link', { name: 'Services' }).click();
    await expect(page).toHaveURL(/services/);
  });

  test('Login Authentication Test', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);

    // Fill in login credentials
    await page.fill('input[name="email"]', USER_EMAIL);
    await page.fill('input[name="password"]', USER_PASSWORD);
    await page.click('button[type="submit"]');

    // Verify successful login
    await expect(page).toHaveURL(/dashboard/);
    await expect(page.locator('.welcome-message')).toContainText(`Welcome, ${USER_EMAIL}`);
  })

  test('API validation Test', async ({ playwright }) => {
    const apiContext = await playwright.request.newContext();

    // send login request
    const loginResponse = await apiContext.post(`${API_BASE_URL}/auth/login`, {
      data: { email: USER_EMAIL, password: USER_PASSWORD }
    })

    expect(loginResponse.status()).toBe(200);
    const loginData = await loginResponse.json();
    const authToken = loginData.token;

    // Fetch user profile using token
    const userProfileResponse = await apiContext.get(`${API_BASE_URL}/user/profile`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });

    expect(userProfileResponse.status()).toBe(200);
    const userProfile = await userProfileResponse.json();

    expect(userProfile.email).toBe(USER_EMAIL);


  })
})

test.describe('API Mocking', () => {
  test('Mock login and user profile API', async ({ page, playwright }) => {
    const apiContext = await playwright.request.newContext();

    // Mock the Login API
    await page.route('https://api.hextrust.com/auth/login', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ token: 'mocked_token_123 '})
      });
    });

    // Mock the User Profile API
    await page.route('https://api.hextrust.com/user/profile', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ email: 'mockuser@hextrust.com', name: 'Mock User' })
      });
    });

    // Simulate login request
    const loginResponse = await apiContext.post(`${API_BASE_URL}/auth/login`, {
      data: { email: USER_EMAIL, password: USER_PASSWORD }
    })

    expect(loginResponse.status()).toBe(200);
    const loginData = await loginResponse.json();
    expect(loginData.token).toBe('mocked_token_123');

    // Simulate fetching user profile
    const userProfileResponse = await apiContext.get(`${API_BASE_URL}/user/profile`, {
      headers: { Authorization: `Bearer ${loginData.token}` }
    });

    expect(userProfileResponse.status()).toBe(200);
    const profileData = await userProfileResponse.json();
    expect(profileData.email).toBe('mockuser@hextrust.com');
    expect(profileData.name).toBe('Mock User');
    
  })
})

/* 
Validating a Bank's API Response in Playwright

Scenario:
Endpoint: /api/bank/account
Request: Get request with an authentication token
Response: JSON with account details
Validations:
  Ensure response contains keys: "account_number", "balance", "currency", "transactions"
  Verify data types: String, Number, String, Array of objects with { id, amount, type, date }
*/

import { request } from '@playwright/test';

// Positive and Negative test cases: invalid authentication (401 unauthorized), missing fields, incorrect data types returned
const INVALID_TOKEN = 'invalid_token_123';

test.describe('Bank API Tests', () => {
  // Positive Test: Valid API Response
  test('Validate Bank API Response', async ({ playwright }) => {
    // Create an isolated API context
    const apiContext = await playwright.request.newContext({
      baseURL: 'https://api.bank.com',
      extraHTTPHeaders: {
        'Authorization': `Bearer ${process.env.BANK_API_TOKEN}`,
        'Accept': 'application/json',
      },
    });
  
    // Send API request
    const response = await apiContext.get('/api/bank/account');
    expect(response.status()).toBe(200);
  
    // Parse the JSON response
    const responseBody = await response.json();
    console.log('Bank API Response:', responseBody);
  
    // Validate response structure & types
    expect(responseBody).toHaveProperty('account_number');
    expect(responseBody).toHaveProperty('balance');
    expect(responseBody).toHaveProperty('currency');
    expect(responseBody).toHaveProperty('transactions');
  
    // Check individual fields
    expect(typeof responseBody.account_number).toBe('string');
    expect(typeof responseBody.balance).toBe('number');
    expect(typeof responseBody.currency).toBe('string');
    expect(Array.isArray(responseBody.transactions)).toBe(true);
  
    // Validate transactions array
    responseBody.transactions.forEach((transaction: any) => {
      expect(transaction).toHaveProperty('id');
      expect(transaction).toHaveProperty('amount');
      expect(transaction).toHaveProperty('type');
      expect(transaction).toHaveProperty('date');
  
      expect(typeof transaction.id).toBe('string');
      expect(typeof transaction.amount).toBe('number');
      expect(['deposit', 'withdrawal', 'transfer']).toContain(transaction.type);
      expect(typeof transaction.date).toBe('string'); // Date should be in string format
    });
  
    console.log('All validations passed successfully!');
  });

  // Negative Test: Invalid Authentication (401 Unauthorized)
  test('Should return 401 for invalid auth', async ({ playwright }) => {
    const apiContext = await playwright.request.newContext({
      baseURL: API_BASE_URL,
      extraHTTPHeaders: {
        'Authorization': `Bearer ${INVALID_TOKEN}`,
        'Accept': 'application/json'
      }
    });

    const response = await apiContext.get('/api/bank/account');
    expect(response.status()).toBe(401);

    const responseBody = await response.json();
    expect(responseBody).toHaveProperty('error');
    expect(responseBody.error).toContain('Unauthorized');
    console.log('Unauthorized error handled correctly', responseBody);
  });

  // Negative Test: Missing Required Fields in Response
  test('Should fail if required fields are missing', async ({ page, playwright }) => {
    await page.route(`${API_BASE_URL}/api/bank/acount`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          account_number: '1234',
          balance: 5000,
          // missing currency and transactions
        })
      })
    });

    const apiContext = await playwright.request.newContext({
      baseURL: API_BASE_URL,
      extraHTTPHeaders: {
        'Authorization': `Bearer ${process.env.VALID_TOKEN}`,
        'Accept': 'application/json'
      }
    });

    const response = await apiContext.get('/api/bank/account');
    const responseBody = await response.json();

    try {
      expect(responseBody).toHaveProperty('account_number');
      expect(responseBody).toHaveProperty('balance');
      expect(responseBody).toHaveProperty('currency');
      expect(responseBody).toHaveProperty('transactions');
    } catch (error) {
      console.error('Test failed: Response is missing required fields:', responseBody)
      throw error; // Forces test to fail
    }
  });
})



test('Hex Trust website End-to-End test', async ({ page }) => {
  // Navigate to hex trust homepage
  await page.goto('https://hextrust.com');

  // Verify page title
  await expect(page).toHaveTitle(/Hex Trust/i);

  // Verify the main header is visible
  const header = page.locator('h1')
  await expect(header).toBeVisible()

  // Navigate to the "Services" page
  // await page.getByRole('link', { name: 'Services' }).hover();
  await page.getByRole('link', { name: 'Login' }).click();

  // Verify that the "Services" page loaded
  await expect(page).toHaveURL(/login/);
  await expect(page.getByText('Log in')).toBeVisible();

  // Perform a UI interaction: Click a "Read More" button
  await page.getByRole('link', { name: 'Contact', exact: true }).click();
  const contactHeader = page.locator('h1');
  await expect(contactHeader).toBeVisible();

  // Validate the new page
  await expect(page).toHaveURL(/contact/);

  console.log('✅ End-to-end test passed!');
})