const fs = require('fs');
const path = require('path');

function getStudentsFixture() {
  const filePath = path.join(__dirname, 'students.json');
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function getDrivesFixture() {
  const filePath = path.join(__dirname, 'drives.json');
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

module.exports = {
  getStudentsFixture,
  getDrivesFixture,
};
