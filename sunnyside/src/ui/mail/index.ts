/**
 * ui/mail/index.ts — барель зоны Каталога почтой (08-mail-foraging §3.1). Панели
 * `ui_mail_catalog`/`ui_mailbox` + DI-провайдер `MailForagingSystem`.
 */

export { MailCatalog } from './MailCatalog'
export { MailboxPanel } from './MailboxPanel'
export { MailSystemProvider, useMailSystem } from './MailSystemContext'
