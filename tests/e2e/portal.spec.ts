import { test, expect } from '@playwright/test';

test.describe('ApniLeap Full-Stack E2E Suite', () => {

  test('Flow 1: Student Login & Real-Time Dashboard View', async ({ page }) => {
    await page.goto('/login');

    // 1. Verify branding and title
    await expect(page.locator('.apni-login-title')).toContainText('ApniLeap');
    await expect(page.locator('.apni-login-subtitle')).toContainText('Campus Placement Platform');

    // 2. Click Student quick-demo button
    await page.click('button.apni-demo-btn:has-text("Student")');

    // Verify fields populated
    await expect(page.locator('input[type="email"]')).toHaveValue('student@apnileap.edu');
    await expect(page.locator('input[type="password"]')).toHaveValue('demo123');

    // 3. Submit login
    await page.click('button.apni-login-submit-btn');

    // 4. Verify redirected to dashboard with verified student profile
    await expect(page).toHaveURL('/');
    await expect(page.locator('.apni-welcome-title')).toContainText('Welcome back');
    await expect(page.locator('.apni-status-indicator')).toBeVisible();
  });

  test('Flow 2: Drive Discovery, Search & Pre-Check Modal Interaction', async ({ page }) => {
    // Login as Student first
    await page.goto('/login');
    await page.click('button.apni-demo-btn:has-text("Student")');
    await page.click('button.apni-login-submit-btn');
    await page.waitForURL('/');

    // Navigate to Placement Drives via sidebar
    await page.click('a[href="/drives"]');
    await expect(page).toHaveURL('/drives');
    await expect(page.locator('.apni-page-title')).toContainText('Placement Recruitment Drives');

    // Search for drives
    const searchInput = page.locator('.apni-search-input');
    await searchInput.fill('Google');
    await page.waitForTimeout(300);

    // Verify drive cards rendered
    const driveCards = page.locator('.apni-drive-card');
    const count = await driveCards.count();
    expect(count).toBeGreaterThanOrEqual(1);

    // Open Pre-check or Apply Modal
    const actionBtn = driveCards.first().locator('button:has-text("View & Apply")');
    if (await actionBtn.isVisible()) {
      await actionBtn.click();
      await expect(page.locator('.apni-modal')).toBeVisible();
      // Close modal
      await page.locator('.apni-modal-close').click();
      await expect(page.locator('.apni-modal')).not.toBeVisible();
    }
  });

  test('Flow 3: Application State Machine Pipeline Tracker', async ({ page }) => {
    // Login as Student
    await page.goto('/login');
    await page.click('button.apni-demo-btn:has-text("Student")');
    await page.click('button.apni-login-submit-btn');
    await page.waitForURL('/');

    // Navigate to Applications
    await page.click('a[href="/applications"]');
    await expect(page).toHaveURL('/applications');
    await expect(page.locator('.apni-page-title')).toContainText('Recruitment Pipeline & Offers');
  });

  test('Flow 4: Shortlist Engine Algorithm Switching', async ({ page }) => {
    // Login as Faculty/TPO
    await page.goto('/login');
    await page.click('button.apni-demo-btn:has-text("Faculty / TPO")');
    await page.click('button.apni-login-submit-btn');
    await page.waitForURL('/');

    // Navigate to Shortlist Engine
    await page.click('a[href="/rankings"]');
    await expect(page).toHaveURL('/rankings');
    await expect(page.locator('.apni-page-title')).toContainText('Candidate Ranking & Shortlist Engine');

    // Verify algorithm selector pills exist
    await expect(page.locator('.apni-algo-pills')).toBeVisible();
    await page.click('button.apni-algo-btn:has-text("Heap Top-K")');
    await expect(page.locator('button.apni-algo-btn:has-text("Heap Top-K")')).toHaveClass(/is-active/);
  });

  test('Flow 5: Institutional Administration & Role Guardrails', async ({ page }) => {
    // 1. Try accessing /admin as Student -> should be redirected away to /
    await page.goto('/login');
    await page.click('button.apni-demo-btn:has-text("Student")');
    await page.click('button.apni-login-submit-btn');
    await page.waitForURL('/');

    await page.goto('/admin');
    await expect(page).toHaveURL('/');

    // 2. Logout
    await page.click('.apni-logout-btn');
    await page.waitForURL('/login');

    // 3. Login as Placement Admin
    await page.click('button.apni-demo-btn:has-text("Placement Admin")');
    await page.click('button.apni-login-submit-btn');
    await page.waitForURL('/');

    // 4. Access Admin Controls
    await page.click('a[href="/admin"]');
    await expect(page).toHaveURL('/admin');
    await expect(page.locator('.apni-page-title')).toContainText('Placement Administration Control Center');

    // 5. Switch to Audit Logs tab
    await page.click('button.apni-tab-btn:has-text("Audit Logs")');
    await expect(page.locator('.apni-section-header h3')).toContainText('Institutional Audit Trail');
  });
});
