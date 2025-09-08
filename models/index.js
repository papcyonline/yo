// MongoDB Models
const User = require('./User');
const PhoneVerification = require('./PhoneVerification');
const EmailVerification = require('./EmailVerification');
const Notification = require('./Notification');
const FriendRequest = require('./FriendRequest');
const { Chat, Message } = require('./Chat');
const BlockedUser = require('./BlockedUser');
const Report = require('./Report');
const FamilyTree = require('./FamilyTree');
const FamilyMember = require('./FamilyMember');

module.exports = {
  User,
  PhoneVerification,
  EmailVerification,
  Notification,
  FriendRequest,
  Chat,
  Message,
  BlockedUser,
  Report,
  FamilyTree,
  FamilyMember
};