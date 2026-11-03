async function setVoidedRole(guild, roleId, userId, enabled) {
  if (!guild || !roleId || !userId) return false;

  const [role, member] = await Promise.all([
    guild.roles.fetch(roleId),
    guild.members.fetch(userId, { force: true }),
  ]);
  if (!role) throw new Error(`Voided role ${roleId} was not found.`);
  if (!member) throw new Error(`Guild member ${userId} was not found.`);

  const hasRole = member.roles.cache.has(role.id);
  if (enabled && !hasRole) {
    await member.roles.add(role);
    return true;
  }
  if (!enabled) {
    await member.roles.remove(role);
    return hasRole;
  }
  return false;
}

module.exports = { setVoidedRole };