const { test, expect } = require('@playwright/test');

const FRONTEND_URL = 'http://localhost:3500';
const BACKEND_URL = 'http://localhost:4100';
const PAGE_URL = FRONTEND_URL + '/prompt-generator.html';

async function waitForBackendConnected(page) {
  await page.waitForFunction(() => {
    const dot = document.getElementById('connectionDot');
    return dot && dot.classList.contains('connected');
  }, { timeout: 10000 }).catch(() => {});
}

async function getActiveTab(page) {
  return page.evaluate(() => {
    const activeBtn = document.querySelector('.tab-btn.active');
    return activeBtn ? activeBtn.getAttribute('data-tab') : null;
  });
}

async function switchToTab(page, tabName) {
  await page.click('.tab-btn[data-tab="' + tabName + '"]');
  await page.waitForTimeout(300);
}

async function openPage(page) {
  await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(1000);
}

module.exports = {
  test,
  expect,
  FRONTEND_URL,
  BACKEND_URL,
  PAGE_URL,
  waitForBackendConnected,
  getActiveTab,
  switchToTab,
  openPage,
};
