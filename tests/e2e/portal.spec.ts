import { test, expect } from '@playwright/test';

test.describe('Placement Portal E2E Tests (Team D)', () => {

  test('Flow 1: Student Login & Dashboard View', async ({ page }) => {
    await page.goto('/');

    // Verify login page loaded
    await expect(page.locator('h1')).toContainText('Discover opportunities');
    await expect(page.locator('#email')).toBeVisible();

    // Sign in as Student
    await page.fill('#email', 'student@placify.edu');
    await page.fill('#password', 'demo123');
    await page.click('button[type="submit"]');

    // Verify dashboard rendered
    await expect(page.locator('h2')).toContainText('Good morning, Priya');
    await expect(page.locator('.user-card')).toContainText('Priya Sharma');
    await expect(page.locator('.user-card')).toContainText('CSE · 4th Year');
  });

  test('Flow 2: Drive Discovery, Search & Modal Interaction', async ({ page }) => {
    await page.goto('/');

    // Login as Student
    await page.fill('#email', 'student@placify.edu');
    await page.fill('#password', 'demo123');
    await page.click('button[type="submit"]');

    // Navigate to Drives
    await page.click('button:has-text("Placement Drives")');
    await expect(page.locator('h2')).toContainText('Active placement drives');

    // Search for a drive
    const searchInput = page.locator('input[aria-label="Search placement drives"]');
    await searchInput.fill('Google');
    await expect(page.locator('.drive-card')).toHaveCount(1);
    await expect(page.locator('.drive-card')).toContainText('Google');

    // Open drive details modal
    await page.click('.drive-card .secondary-button');
    const modal = page.locator('.drive-modal');
    await expect(modal).toBeVisible();
    await expect(modal.locator('#drive-title')).toContainText('Google');

    // Check eligibility button
    const checkEligBtn = modal.locator('button:has-text("Check eligibility")');
    if (await checkEligBtn.isVisible()) {
      await checkEligBtn.click();
      await expect(modal.locator('.eligibility-result')).toBeVisible();
    }

    // Close modal
    await modal.locator('.modal-close').click();
    await expect(modal).not.toBeVisible();
  });

  test('Flow 3: Role-Based Access Control (Placement Admin)', async ({ page }) => {
    await page.goto('/');

    // Select Placement Admin role on login screen
    await page.click('button:has-text("Placement Admin")');
    await page.fill('#email', 'admin@placify.edu');
    await page.fill('#password', 'admin123');
    await page.click('button[type="submit"]');

    // Admin should see management options and role info
    await expect(page.locator('.user-card')).toContainText('Placement Admin');
    await expect(page.locator('.user-card')).toContainText('Rhea Verma');
    await expect(page.locator('button:has-text("Drive Management")')).toBeVisible();

    // Navigate to Drive Management
    await page.click('button:has-text("Drive Management")');
    await expect(page.locator('h2')).toContainText('Administrative actions');
  });

  test('Flow 4: Keyboard Navigation and Accessibility', async ({ page }) => {
    await page.goto('/');

    // Focus starts or moves via keyboard
    await page.locator('#email').focus();
    await page.keyboard.type('test@placify.edu');
    await page.keyboard.press('Tab');

    // Password field should be focused
    await expect(page.locator('#password')).toBeFocused();
    await page.keyboard.type('testpassword');
  });

  test('Flow 5: Responsive Layout (Mobile and Desktop)', async ({ page }) => {
    // Mobile Viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await expect(page.locator('.login-card')).toBeVisible();

    // Desktop Viewport
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/');
    await expect(page.locator('.login-visual')).toBeVisible();
  });

});
