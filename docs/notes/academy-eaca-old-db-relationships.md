# Academy (EACA) — Complete old-database relationships

Companion to [`academy-eaca-migration.md`](./academy-eaca-migration.md).

**Source:** `FOREIGN KEY` constraints extracted from [`Academy/Sawa_LTD.sql`](../../Academy/Sawa_LTD.sql).

| Metric | Value |
|--------|------:|
| `dbo` tables | 502 |
| Declared FK constraints | 2243 |
| Tables that are FK children | 440 |
| Tables that are FK parents | 180 |
| Tables with no FK involvement | 49 |
| Empty tables (0 rows in snapshot) | 292 |
| Empty tables still referenced as parents | 81 |

> **Empty ≠ irrelevant.** Many empty tables still appear in the FK graph (lookups, unused modules, features ready but never filled in this backup). Relationships below include them.

Row counts from `TableRowCount.xlsx`. `(EMPTY)` means 0 rows in the snapshot.

---

## How to read this

- **Outgoing FK** = this table’s column points at another table (dependency).
- **Incoming FK** = other tables point at this table (dependents / children).
- Junction tables (`GENClassroom_GENContact`, `Course_Session`, `PollCategoryandPolls`, …) are the many-to-many edges of the LMS.

For **business flows** (enroll → attend → exam → certify), see §2.7 in the main migration note.

---


## Core LMS hub relationships (detailed)

### `AspNetUsers` — 40,910 rows

**Depends on (outgoing FKs):**

| From | | To |
|------|--|----|
| `AspNetUsers.OfficialOrganizationId` | → | `GENCompanies.Id` |

**Referenced by (incoming FKs):**

| From | | To |
|------|--|----|
| `GENRatings.UserId` | → | `AspNetUsers.Id` |
| `GENContacts.DeletedById` | → | `AspNetUsers.Id` |
| `GENContacts.UserId` | → | `AspNetUsers.Id` |
| `PushMSGUsers.UserId` | → | `AspNetUsers.Id` |
| `SysUserLoginHistories.LastUpdatedById` | → | `AspNetUsers.Id` |
| `SysUserLoginHistories.UserId` | → | `AspNetUsers.Id` |
| `GENItems.DeletedById` | → | `AspNetUsers.Id` |
| `GENOrders.UserId` | → | `AspNetUsers.Id` |
| `GENClassrooms.DeletedById` | → | `AspNetUsers.Id` |
| `GENTypeCategories.DeletedById` | → | `AspNetUsers.Id` |
| `SysErrorLogs.UserId` | → | `AspNetUsers.Id` |
| `GENEmployees.DeletedById` | → | `AspNetUsers.Id` |
| `GENEmployees.UserId` | → | `AspNetUsers.Id` |
| `GENWikis.DeletedById` | → | `AspNetUsers.Id` |
| `GENTypes.DeletedById` | → | `AspNetUsers.Id` |
| `GENChatMessages.UserReceiverId` | → | `AspNetUsers.Id` |
| `GENChatMessages.UserSenderId` | → | `AspNetUsers.Id` |
| `GENTalents.DeletedById` | → | `AspNetUsers.Id` |
| `GENChatPairConnections.RecieverId` | → | `AspNetUsers.Id` |
| `GENChatPairConnections.SenderId` | → | `AspNetUsers.Id` |
| `GENChatGroupMessages.UserReceiverId` | → | `AspNetUsers.Id` |
| `GENTalentBuilders.DeletedById` | → | `AspNetUsers.Id` |
| `GENChatGroupUsers.UserId` | → | `AspNetUsers.Id` |
| `Emogies.CreatedById` | → | `AspNetUsers.Id` |
| `Emogies.LastUpdatedById` | → | `AspNetUsers.Id` |
| `CRMSRVTicketTypes.CreatedById` | → | `AspNetUsers.Id` |
| `CRMSRVTicketTypes.DeletedById` | → | `AspNetUsers.Id` |
| `CRMSRVTicketTypes.LastUpdatedById` | → | `AspNetUsers.Id` |
| `GENCertificationFrames.CreatedById` | → | `AspNetUsers.Id` |
| `GENCertificationFrames.LastUpdatedById` | → | `AspNetUsers.Id` |
| `GENCertifications.CreatedById` | → | `AspNetUsers.Id` |
| `GENCertifications.LastUpdatedById` | → | `AspNetUsers.Id` |
| `GENProfessionalExperiences.CreatedById` | → | `AspNetUsers.Id` |
| `GENProfessionalExperiences.LastUpdatedById` | → | `AspNetUsers.Id` |
| `AspNetUserClaims.UserId` | → | `AspNetUsers.Id` |
| `GENBlogs.CreatedById` | → | `AspNetUsers.Id` |
| `GENBlogs.DeletedById` | → | `AspNetUsers.Id` |
| `GENBlogs.LastUpdatedById` | → | `AspNetUsers.Id` |
| `GENBlogs.UserId` | → | `AspNetUsers.Id` |
| `GENComments.CreatedById` | → | `AspNetUsers.Id` |
| `GENComments.DeletedById` | → | `AspNetUsers.Id` |
| `GENComments.LastUpdatedById` | → | `AspNetUsers.Id` |
| `GENComments.UserId` | → | `AspNetUsers.Id` |
| `GENTagCategories.CreatedById` | → | `AspNetUsers.Id` |
| `GENTagCategories.LastUpdatedById` | → | `AspNetUsers.Id` |
| `AspNetUserAddresses.UserId` (EMPTY) | → | `AspNetUsers.Id` |
| `AspNetUserLogins.UserId` (EMPTY) | → | `AspNetUsers.Id` |
| `AspNetUserPhones.UserId` (EMPTY) | → | `AspNetUsers.Id` |
| `CRMSRVIssues.CreatedById` (EMPTY) | → | `AspNetUsers.Id` |
| `CRMSRVIssues.DeletedById` (EMPTY) | → | `AspNetUsers.Id` |
| `CRMSRVIssues.LastUpdatedById` (EMPTY) | → | `AspNetUsers.Id` |
| `CRMSRVMaintenanceRoleCategories.CreatedById` (EMPTY) | → | `AspNetUsers.Id` |
| `CRMSRVMaintenanceRoleCategories.DeletedById` (EMPTY) | → | `AspNetUsers.Id` |
| `CRMSRVMaintenanceRoleCategories.LastUpdatedById` (EMPTY) | → | `AspNetUsers.Id` |
| `CRMSRVMaintenanceRoles.CreatedById` (EMPTY) | → | `AspNetUsers.Id` |
| `CRMSRVMaintenanceRoles.DeletedById` (EMPTY) | → | `AspNetUsers.Id` |
| `CRMSRVMaintenanceRoles.LastUpdatedById` (EMPTY) | → | `AspNetUsers.Id` |
| `CRMSRVReasonTypes.CreatedById` (EMPTY) | → | `AspNetUsers.Id` |
| `CRMSRVReasonTypes.LastUpdatedById` (EMPTY) | → | `AspNetUsers.Id` |
| `CRMSRVReasons.CreatedById` (EMPTY) | → | `AspNetUsers.Id` |
| `CRMSRVReasons.LastUpdatedById` (EMPTY) | → | `AspNetUsers.Id` |
| `CRMSRVReservations.CreatedById` (EMPTY) | → | `AspNetUsers.Id` |
| `CRMSRVReservations.DeletedById` (EMPTY) | → | `AspNetUsers.Id` |
| `CRMSRVReservations.LastUpdatedById` (EMPTY) | → | `AspNetUsers.Id` |
| `CRMSRVTicket_BranchTransfer.CreatedById` (EMPTY) | → | `AspNetUsers.Id` |
| `CRMSRVTicket_BranchTransfer.DeletedById` (EMPTY) | → | `AspNetUsers.Id` |
| `CRMSRVTicket_BranchTransfer.LastUpdatedById` (EMPTY) | → | `AspNetUsers.Id` |
| `CRMSRVTicket_Comment.CreatedById` (EMPTY) | → | `AspNetUsers.Id` |
| `CRMSRVTicket_Comment.DeletedById` (EMPTY) | → | `AspNetUsers.Id` |
| `CRMSRVTicket_Comment.LastUpdatedById` (EMPTY) | → | `AspNetUsers.Id` |
| `CRMSRVTicket_Issue.CreatedById` (EMPTY) | → | `AspNetUsers.Id` |
| `CRMSRVTicket_Issue.DeletedById` (EMPTY) | → | `AspNetUsers.Id` |
| `CRMSRVTicket_Issue.LastUpdatedById` (EMPTY) | → | `AspNetUsers.Id` |
| `CRMSRVTicket_ItemAttachment.CreatedById` (EMPTY) | → | `AspNetUsers.Id` |
| `CRMSRVTicket_ItemAttachment.DeletedById` (EMPTY) | → | `AspNetUsers.Id` |
| `CRMSRVTicket_ItemAttachment.LastUpdatedById` (EMPTY) | → | `AspNetUsers.Id` |
| `CRMSRVTicket_MaintenanceWork.CreatedById` (EMPTY) | → | `AspNetUsers.Id` |
| `CRMSRVTicket_MaintenanceWork.DeletedById` (EMPTY) | → | `AspNetUsers.Id` |
| `CRMSRVTicket_MaintenanceWork.LastUpdatedById` (EMPTY) | → | `AspNetUsers.Id` |
| `CRMSRVTicket_Sparepart.CreatedById` (EMPTY) | → | `AspNetUsers.Id` |
| `CRMSRVTicket_Sparepart.DeletedById` (EMPTY) | → | `AspNetUsers.Id` |
| `CRMSRVTicket_Sparepart.LastUpdatedById` (EMPTY) | → | `AspNetUsers.Id` |
| `CRMSRVTickets.CreatedById` (EMPTY) | → | `AspNetUsers.Id` |
| `CRMSRVTickets.DeletedById` (EMPTY) | → | `AspNetUsers.Id` |
| `CRMSRVTickets.LastUpdatedById` (EMPTY) | → | `AspNetUsers.Id` |
| `CandidateEmployees.CreatedById` (EMPTY) | → | `AspNetUsers.Id` |
| `CandidateEmployees.LastUpdatedById` (EMPTY) | → | `AspNetUsers.Id` |
| `EmogyUserReplies.UserId` (EMPTY) | → | `AspNetUsers.Id` |
| `GENBulkRequests.CreatedById` (EMPTY) | → | `AspNetUsers.Id` |
| `GENBulkRequests.DeletedById` (EMPTY) | → | `AspNetUsers.Id` |
| `GENBulkRequests.LastUpdatedById` (EMPTY) | → | `AspNetUsers.Id` |
| `GENBulkRequests.UserId` (EMPTY) | → | `AspNetUsers.Id` |
| `GENCompetitionUserItems.UserId` (EMPTY) | → | `AspNetUsers.Id` |
| `GENDriverRatings.UserId` (EMPTY) | → | `AspNetUsers.Id` |
| `GENRawDatas.UserId` (EMPTY) | → | `AspNetUsers.Id` |
| `GENReacts.CreatedById` (EMPTY) | → | `AspNetUsers.Id` |
| `GENReacts.LastUpdatedById` (EMPTY) | → | `AspNetUsers.Id` |
| `GENReacts.UserId` (EMPTY) | → | `AspNetUsers.Id` |
| `GENRequestLocations.DeletedById` (EMPTY) | → | `AspNetUsers.Id` |
| `GENRequests.CreatedById` (EMPTY) | → | `AspNetUsers.Id` |
| `GENRequests.DeletedById` (EMPTY) | → | `AspNetUsers.Id` |
| `GENRequests.LastUpdatedById` (EMPTY) | → | `AspNetUsers.Id` |
| `GENRequests.UserId` (EMPTY) | → | `AspNetUsers.Id` |
| `GENReviews.UserId` (EMPTY) | → | `AspNetUsers.Id` |
| `GENUserLikes.UserId` (EMPTY) | → | `AspNetUsers.Id` |
| `GENVehicleUsers.User_Id` (EMPTY) | → | `AspNetUsers.Id` |
| `ImportLogDatas.UserId` (EMPTY) | → | `AspNetUsers.Id` |

### `AspNetRoles` — 14 rows

**Referenced by (incoming FKs):**

| From | | To |
|------|--|----|
| `BasetabGENPageOfPagesRoles.RoleId` | → | `AspNetRoles.Id` |
| `Authentications.IdentityRoleId` | → | `AspNetRoles.Id` |
| `GENTranslate_Role.RoleId` | → | `AspNetRoles.Id` |
| `PageofPageReport_Role.IdentityRoleId` | → | `AspNetRoles.Id` |
| `AuthenticationPageOfPages.IdentityRoleId` (EMPTY) | → | `AspNetRoles.Id` |

### `GENContacts` — 51,607 rows

**Depends on (outgoing FKs):**

| From | | To |
|------|--|----|
| `GENContacts.DeletedById` | → | `AspNetUsers.Id` |
| `GENContacts.UserId` | → | `AspNetUsers.Id` |
| `GENContacts.BaseEntityId` | → | `BaseEntities.Id` |
| `GENContacts.ReasonId` | → | `CRMSRVReasons.Id` (EMPTY) |
| `GENContacts.SourceId` | → | `CRMSources.Id` |
| `GENContacts.CRMTicket_Id` | → | `CRMTickets.Id` (EMPTY) |
| `GENContacts.CompanyId` | → | `GENCompanies.Id` |
| `GENContacts.OfficialOrganizationId` | → | `GENCompanies.Id` |
| `GENContacts.ContactCategoryId` | → | `GENContactCategories.Id` |
| `GENContacts.ContactTypeId` | → | `GENContactTypes.Id` |
| `GENContacts.ReferralId` | → | `GENContacts.Id` |
| `GENContacts.DepartmentId` | → | `GENDepartments.Id` |
| `GENContacts.GovernorateId` | → | `GENGovernorates.Id` |
| `GENContacts.AssessmentId` | → | `GENListValues.Id` |
| `GENContacts.BirthplaceId` | → | `GENListValues.Id` |
| `GENContacts.ClubId` | → | `GENListValues.Id` |
| `GENContacts.EmployerId` | → | `GENListValues.Id` |
| `GENContacts.GenderId` | → | `GENListValues.Id` |
| `GENContacts.IDNumberCheckId` | → | `GENListValues.Id` |
| `GENContacts.JobId` | → | `GENListValues.Id` |
| `GENContacts.LanguageId` | → | `GENListValues.Id` |
| `GENContacts.MartialStatusId` | → | `GENListValues.Id` |
| `GENContacts.NationalityId` | → | `GENListValues.Id` |
| `GENContacts.PositionRecruitmentId` | → | `GENListValues.Id` |
| `GENContacts.PriortyId` | → | `GENListValues.Id` |
| `GENContacts.QualificationId` | → | `GENListValues.Id` |
| `GENContacts.RelativeRelationId` | → | `GENListValues.Id` |
| `GENContacts.ReligionId` | → | `GENListValues.Id` |
| `GENContacts.RentPeriodId` | → | `GENListValues.Id` |
| `GENContacts.SocialStatusId` | → | `GENListValues.Id` |
| `GENContacts.TypeofPersonalizationId` | → | `GENListValues.Id` |
| `GENContacts.ValueId1` | → | `GENListValues.Id` |
| `GENContacts.ValueId2` | → | `GENListValues.Id` |
| `GENContacts.ValueId3` | → | `GENListValues.Id` |
| `GENContacts.ValueId4` | → | `GENListValues.Id` |
| `GENContacts.ValueId5` | → | `GENListValues.Id` |
| `GENContacts.PageOfPageId` | → | `GENPageOfPages.Id` |
| `GENContacts.PaymentMethodId` | → | `GENPaymentMethods.Id` |
| `GENContacts.SalutationId` | → | `GENSalutations.Id` |
| `GENContacts.StatusId` | → | `GENStatus.Id` |
| `GENContacts.IconId` | → | `GENStyles.Id` |
| `GENContacts.TypeId` | → | `GENTypes.Id` |

**Referenced by (incoming FKs):**

| From | | To |
|------|--|----|
| `Classroom_Attendance.StudentId` | → | `GENContacts.Id` |
| `GENClassroom_GENContact.StudentId` | → | `GENContacts.Id` |
| `GENContacts.ReferralId` | → | `GENContacts.Id` |
| `GENCertificates.ContactId` | → | `GENContacts.Id` |
| `Contacts_Courses.StudentId` | → | `GENContacts.Id` |
| `GENExamAnswerHeaders.StudentId` | → | `GENContacts.Id` |
| `GENContactEmails.ContactId` | → | `GENContacts.Id` |
| `ContactInfoes.ContactId` | → | `GENContacts.Id` |
| `GENContactPhones.ContactId` | → | `GENContacts.Id` |
| `PushMSGUsers.ContactId` | → | `GENContacts.Id` |
| `GENContactProgressCompletions.ContactId` | → | `GENContacts.Id` |
| `GENItems.OwnerId` | → | `GENContacts.Id` |
| `GENOrders.ContactId` | → | `GENContacts.Id` |
| `GENEmployees.ContactId` | → | `GENContacts.Id` |
| `GENContact_Talent.ContactId` | → | `GENContacts.Id` |
| `GENWikis.ContactId` | → | `GENContacts.Id` |
| `CRMClient_Contact.ContactId` (EMPTY) | → | `GENContacts.Id` |
| `CRMDeals.ContactId` (EMPTY) | → | `GENContacts.Id` |
| `CRMQuotes.ContactId` (EMPTY) | → | `GENContacts.Id` |
| `CRMQuotes.DealContactId` (EMPTY) | → | `GENContacts.Id` |
| `CRMSRVTicket_Comment.MainContactId` (EMPTY) | → | `GENContacts.Id` |
| `CRMSRVTickets.ContactId` (EMPTY) | → | `GENContacts.Id` |
| `CRMTickets.ContactId` (EMPTY) | → | `GENContacts.Id` |
| `GENCertification_Requests.StudentId` (EMPTY) | → | `GENContacts.Id` |
| `GENContactAddresses.ContactId` (EMPTY) | → | `GENContacts.Id` |
| `GENContactComments.ContactId` (EMPTY) | → | `GENContacts.Id` |
| `GENContact_Generic.ContactId` (EMPTY) | → | `GENContacts.Id` |
| `GENContact_News.ContactId` (EMPTY) | → | `GENContacts.Id` |
| `GENProjects.ContactId` (EMPTY) | → | `GENContacts.Id` |
| `GENProjects.ReferralId` (EMPTY) | → | `GENContacts.Id` |
| `GENRequests.ContactId` (EMPTY) | → | `GENContacts.Id` |
| `GENTCRs.ContactId` (EMPTY) | → | `GENContacts.Id` |
| `GENTCRs.DealContactId` (EMPTY) | → | `GENContacts.Id` |
| `GENTranslate_Contact.ContactId` (EMPTY) | → | `GENContacts.Id` |
| `GENUserLocations.ContactId` (EMPTY) | → | `GENContacts.Id` |
| `GENVehicles.OwnerContactId` (EMPTY) | → | `GENContacts.Id` |
| `Items_Generic.ContactId` (EMPTY) | → | `GENContacts.Id` |

### `GENEmployees` — 824 rows

**Depends on (outgoing FKs):**

| From | | To |
|------|--|----|
| `GENEmployees.DeletedById` | → | `AspNetUsers.Id` |
| `GENEmployees.UserId` | → | `AspNetUsers.Id` |
| `GENEmployees.CRMSRVRequester_Id` | → | `CRMSRVRequesters.Id` (EMPTY) |
| `GENEmployees.BaseBranchId` | → | `GENBranches.Id` |
| `GENEmployees.ClassificationId` | → | `GENClassifications.Id` |
| `GENEmployees.GENCompany_Id` | → | `GENCompanies.Id` |
| `GENEmployees.ContactId` | → | `GENContacts.Id` |
| `GENEmployees.DepartmentId` | → | `GENDepartments.Id` |
| `GENEmployees.EmployeeCategoryId` | → | `GENEmployeeCategories.Id` |
| `GENEmployees.EmployeeTypeId` | → | `GENEmployeeTypes.Id` |
| `GENEmployees.EmployeeId` | → | `GENEmployees.Id` |
| `GENEmployees.GenderId` | → | `GENListValues.Id` |
| `GENEmployees.JobCategoryId` | → | `GENListValues.Id` |
| `GENEmployees.Language1Id` | → | `GENListValues.Id` |
| `GENEmployees.Language2Id` | → | `GENListValues.Id` |
| `GENEmployees.MartialStatusId` | → | `GENListValues.Id` |
| `GENEmployees.MilitaryStatusId` | → | `GENListValues.Id` |
| `GENEmployees.QualificationId` | → | `GENListValues.Id` |
| `GENEmployees.ValueId1` | → | `GENListValues.Id` |
| `GENEmployees.ValueId2` | → | `GENListValues.Id` |
| `GENEmployees.ValueId3` | → | `GENListValues.Id` |
| `GENEmployees.ValueId4` | → | `GENListValues.Id` |
| `GENEmployees.ValueId5` | → | `GENListValues.Id` |
| `GENEmployees.SalutationId` | → | `GENSalutations.Id` |
| `GENEmployees.IconId` | → | `GENStyles.Id` |

**Referenced by (incoming FKs):**

| From | | To |
|------|--|----|
| `TLMSClassroom_Session.InstructorId` | → | `GENEmployees.Id` |
| `GENExamAnswerHeaders.InstructorId` | → | `GENEmployees.Id` |
| `Classroom_Session_Instructor.InstructorId` | → | `GENEmployees.Id` |
| `GENFeedBacks.EmployeeId` | → | `GENEmployees.Id` |
| `PushMSGUsers.EmployeeId` | → | `GENEmployees.Id` |
| `GENCompanies.LastDiscountById` | → | `GENEmployees.Id` |
| `GENCompanies.MainContactId` | → | `GENEmployees.Id` |
| `GENClassrooms.InstructorId` | → | `GENEmployees.Id` |
| `GENEmployees.EmployeeId` | → | `GENEmployees.Id` |
| `OTP_Attendance.InstructorId` | → | `GENEmployees.Id` |
| `CompanyLogDatas.MainContactId` | → | `GENEmployees.Id` |
| `GENCertificationFrames.EmployeeId` | → | `GENEmployees.Id` |
| `GENCertifications.EmployeeId` | → | `GENEmployees.Id` |
| `GENProfessionalExperiences.EmployeeId` | → | `GENEmployees.Id` |
| `ActivityEmployees.EmployeeId` (EMPTY) | → | `GENEmployees.Id` |
| `CRMDeals.EscalatedById` (EMPTY) | → | `GENEmployees.Id` |
| `CRMDeals.EscalatedTo` (EMPTY) | → | `GENEmployees.Id` |
| `CRMDeals.ResponsiblePersonId` (EMPTY) | → | `GENEmployees.Id` |
| `CRMQuotes.DealResponsiblePersonId` (EMPTY) | → | `GENEmployees.Id` |
| `CRMQuotes.EmployeeId` (EMPTY) | → | `GENEmployees.Id` |
| `CRMSRVRequesters.MainContactId` (EMPTY) | → | `GENEmployees.Id` |
| `CRMSRVTicketVisits.EmployeeId` (EMPTY) | → | `GENEmployees.Id` |
| `CRMSRVTicket_BranchTransfer.DelieveredById` (EMPTY) | → | `GENEmployees.Id` |
| `CRMSRVTicket_MaintenanceWork.EmployeeId` (EMPTY) | → | `GENEmployees.Id` |
| `CRMTickets.EmployeeId` (EMPTY) | → | `GENEmployees.Id` |
| `CRMTickets.EscalatedById` (EMPTY) | → | `GENEmployees.Id` |
| `CRMTickets.EscalatedTo` (EMPTY) | → | `GENEmployees.Id` |
| `CandidateEmployees.EmployeeId` (EMPTY) | → | `GENEmployees.Id` |
| `EmployeeEscalations.EmployeeId` (EMPTY) | → | `GENEmployees.Id` |
| `GENEmployeeRatings.EmployeeId` (EMPTY) | → | `GENEmployees.Id` |
| `GENFileAttachments.EmployeeId` (EMPTY) | → | `GENEmployees.Id` |
| `GENProcessHistories.CreatedToId` (EMPTY) | → | `GENEmployees.Id` |
| `GENRequests.MainEmployeeId` (EMPTY) | → | `GENEmployees.Id` |
| `GENTCRs.DealResponsiblePersonId` (EMPTY) | → | `GENEmployees.Id` |
| `GENTCRs.EmployeeId` (EMPTY) | → | `GENEmployees.Id` |
| `GENTranslate_Employee.EmployeeId` (EMPTY) | → | `GENEmployees.Id` |
| `GENUserLocations.EmployeeId` (EMPTY) | → | `GENEmployees.Id` |
| `GENVehicles.LicenseIssuerId` (EMPTY) | → | `GENEmployees.Id` |
| `GENVehicles.OwnerEmployeeId` (EMPTY) | → | `GENEmployees.Id` |

### `GENCompanies` — 6,045 rows

**Depends on (outgoing FKs):**

| From | | To |
|------|--|----|
| `GENCompanies.SourceId` | → | `CRMSources.Id` |
| `GENCompanies.CompanyTypeId` | → | `GENCompanyTypes.Id` |
| `GENCompanies.CurrencyId` | → | `GENCurrencies.Id` |
| `GENCompanies.LastDiscountById` | → | `GENEmployees.Id` |
| `GENCompanies.MainContactId` | → | `GENEmployees.Id` |
| `GENCompanies.IndustryId` | → | `GENIndustries.Id` |
| `GENCompanies.ValueId1` | → | `GENListValues.Id` |
| `GENCompanies.ValueId2` | → | `GENListValues.Id` |
| `GENCompanies.ValueId3` | → | `GENListValues.Id` |
| `GENCompanies.ValueId4` | → | `GENListValues.Id` |
| `GENCompanies.ValueId5` | → | `GENListValues.Id` |
| `GENCompanies.PaymentMethodId` | → | `GENPaymentMethods.Id` |
| `GENCompanies.StatusId` | → | `GENStatus.Id` |
| `GENCompanies.IconId` | → | `GENStyles.Id` |

**Referenced by (incoming FKs):**

| From | | To |
|------|--|----|
| `GENPushNotifications.CompanyId` | → | `GENCompanies.Id` |
| `GENContacts.CompanyId` | → | `GENCompanies.Id` |
| `GENContacts.OfficialOrganizationId` | → | `GENCompanies.Id` |
| `AspNetUsers.OfficialOrganizationId` | → | `GENCompanies.Id` |
| `GENItems.CompanyId` | → | `GENCompanies.Id` |
| `GENClassrooms.CompanyId` | → | `GENCompanies.Id` |
| `GENClassrooms.DestinationsId` | → | `GENCompanies.Id` |
| `GENClassrooms.OrganizationId` | → | `GENCompanies.Id` |
| `GENEmployees.GENCompany_Id` | → | `GENCompanies.Id` |
| `AchievementsOpenBals.CompanyId` | → | `GENCompanies.Id` |
| `GENPushNotificationArchives.CompanyId` | → | `GENCompanies.Id` |
| `GENCompanyEmails.CompanyId` | → | `GENCompanies.Id` |
| `GENCompanyPhones.CompanyId` | → | `GENCompanies.Id` |
| `GENDepartments.GENCompanyId` | → | `GENCompanies.Id` |
| `GENBranches.GENCompany_Id` | → | `GENCompanies.Id` |
| `CRMDeals.CompanyId` (EMPTY) | → | `GENCompanies.Id` |
| `CRMQuotes.CompanyId` (EMPTY) | → | `GENCompanies.Id` |
| `CRMQuotes.DealCompanyId` (EMPTY) | → | `GENCompanies.Id` |
| `CRMSRVTickets.GENCompanyId` (EMPTY) | → | `GENCompanies.Id` |
| `CRMTickets.CompanyId` (EMPTY) | → | `GENCompanies.Id` |
| `GENBulkRequests.CompanyId` (EMPTY) | → | `GENCompanies.Id` |
| `GENCompaniesRatings.CompaniesId` (EMPTY) | → | `GENCompanies.Id` |
| `GENCompanyAddresses.CompanyId` (EMPTY) | → | `GENCompanies.Id` |
| `GENCompanyComments.CompanyId` (EMPTY) | → | `GENCompanies.Id` |
| `GENPerson_Details.CompanyId` (EMPTY) | → | `GENCompanies.Id` |
| `GENProjects.CompanyId` (EMPTY) | → | `GENCompanies.Id` |
| `GENRawDatas.CompanyId` (EMPTY) | → | `GENCompanies.Id` |
| `GENRequests.CompanyId` (EMPTY) | → | `GENCompanies.Id` |
| `GENTCRs.DealCompanyId` (EMPTY) | → | `GENCompanies.Id` |
| `GENTranslate_Company.CompanyId` (EMPTY) | → | `GENCompanies.Id` |
| `GENVehicles.GENCompany_Id` (EMPTY) | → | `GENCompanies.Id` |
| `ImportLogDatas.CompanyId` (EMPTY) | → | `GENCompanies.Id` |

### `GENTalentBuilders` — 40 rows

**Depends on (outgoing FKs):**

| From | | To |
|------|--|----|
| `GENTalentBuilders.DeletedById` | → | `AspNetUsers.Id` |
| `GENTalentBuilders.ValueId1` | → | `GENListValues.Id` |
| `GENTalentBuilders.ValueId2` | → | `GENListValues.Id` |
| `GENTalentBuilders.ValueId3` | → | `GENListValues.Id` |
| `GENTalentBuilders.ValueId4` | → | `GENListValues.Id` |
| `GENTalentBuilders.ValueId5` | → | `GENListValues.Id` |
| `GENTalentBuilders.IconId` | → | `GENStyles.Id` |

**Referenced by (incoming FKs):**

| From | | To |
|------|--|----|
| `GENTypeCategories.TalentBuilderId` | → | `GENTalentBuilders.Id` |
| `GENTalents.TalentBuilderId` | → | `GENTalentBuilders.Id` |
| `DependencyTalentBuilders.DependencyTalentBuilderId` (EMPTY) | → | `GENTalentBuilders.Id` |
| `DependencyTalentBuilders.MainTalentBuilderId` (EMPTY) | → | `GENTalentBuilders.Id` |
| `GENTranslate_GENTalentBuilder.TalentBuilderId` (EMPTY) | → | `GENTalentBuilders.Id` |

### `GENTalents` — 108 rows

**Depends on (outgoing FKs):**

| From | | To |
|------|--|----|
| `GENTalents.DeletedById` | → | `AspNetUsers.Id` |
| `GENTalents.ValueId1` | → | `GENListValues.Id` |
| `GENTalents.ValueId2` | → | `GENListValues.Id` |
| `GENTalents.ValueId3` | → | `GENListValues.Id` |
| `GENTalents.ValueId4` | → | `GENListValues.Id` |
| `GENTalents.ValueId5` | → | `GENListValues.Id` |
| `GENTalents.IconId` | → | `GENStyles.Id` |
| `GENTalents.TalentBuilderId` | → | `GENTalentBuilders.Id` |

**Referenced by (incoming FKs):**

| From | | To |
|------|--|----|
| `Contacts_Courses.TalentId` | → | `GENTalents.Id` |
| `GENOrders.TalentId` | → | `GENTalents.Id` |
| `GENTypeCategories.TalentId` | → | `GENTalents.Id` |
| `GENTalents_Generic.TalentId` | → | `GENTalents.Id` |
| `GENContact_Talent.TalentId` | → | `GENTalents.Id` |
| `Zoom_Session.TalentId` | → | `GENTalents.Id` |
| `GENBlogs.TalentId` | → | `GENTalents.Id` |
| `GENExam_GENTalent.TalentId` (EMPTY) | → | `GENTalents.Id` |
| `GENFileAttachments.TalentId` (EMPTY) | → | `GENTalents.Id` |
| `GENTranslate_GENTalent.TalentId` (EMPTY) | → | `GENTalents.Id` |

### `GENTypeCategories` — 1,886 rows

**Depends on (outgoing FKs):**

| From | | To |
|------|--|----|
| `GENTypeCategories.DeletedById` | → | `AspNetUsers.Id` |
| `GENTypeCategories.IconId` | → | `GENStyles.Id` |
| `GENTypeCategories.TalentBuilderId` | → | `GENTalentBuilders.Id` |
| `GENTypeCategories.TalentId` | → | `GENTalents.Id` |
| `GENTypeCategories.ParentId` | → | `GENTypeCategories.Id` |

**Referenced by (incoming FKs):**

| From | | To |
|------|--|----|
| `GENTypeCategories.ParentId` | → | `GENTypeCategories.Id` |
| `CourseCategories.CategoryId` | → | `GENTypeCategories.Id` |
| `GENTypes.TypeCategoryId` | → | `GENTypeCategories.Id` |
| `GENTranslate_TypeCategory.TypeCategoryId` | → | `GENTypeCategories.Id` |

### `GENTypes` — 416 rows

**Depends on (outgoing FKs):**

| From | | To |
|------|--|----|
| `GENTypes.DeletedById` | → | `AspNetUsers.Id` |
| `GENTypes.LanguageId` | → | `GENListValues.Id` |
| `GENTypes.ValueId1` | → | `GENListValues.Id` |
| `GENTypes.ValueId2` | → | `GENListValues.Id` |
| `GENTypes.ValueId3` | → | `GENListValues.Id` |
| `GENTypes.ValueId4` | → | `GENListValues.Id` |
| `GENTypes.ValueId5` | → | `GENListValues.Id` |
| `GENTypes.IconId` | → | `GENStyles.Id` |
| `GENTypes.TypeCategoryId` | → | `GENTypeCategories.Id` |

**Referenced by (incoming FKs):**

| From | | To |
|------|--|----|
| `GENContacts.TypeId` | → | `GENTypes.Id` |
| `Contacts_Courses.CourseId` | → | `GENTypes.Id` |
| `GENExamAnswerHeaders.CourseId` | → | `GENTypes.Id` |
| `GENFeedBacks.CourseId` | → | `GENTypes.Id` |
| `GENContactProgressCompletions.CourseId` | → | `GENTypes.Id` |
| `GENItems.TypeId` | → | `GENTypes.Id` |
| `Course_Session.CourseId` | → | `GENTypes.Id` |
| `GENOrders.TypeId` | → | `GENTypes.Id` |
| `GENClassrooms.CourseId` | → | `GENTypes.Id` |
| `CourseCategories.CourseId` | → | `GENTypes.Id` |
| `GENTranslate_Type.TypeId` | → | `GENTypes.Id` |
| `GENExam_GENType.CourseId` | → | `GENTypes.Id` |
| `Zoom_Session.CourseId` | → | `GENTypes.Id` |
| `GENType_Course.DependencyCourseId` | → | `GENTypes.Id` |
| `GENType_Course.MainCourseId` | → | `GENTypes.Id` |
| `GENBlogs.CourseId` | → | `GENTypes.Id` |
| `CRMDeals.TypeId` (EMPTY) | → | `GENTypes.Id` |
| `CRMQuotes.TypeId` (EMPTY) | → | `GENTypes.Id` |
| `Course_Question.CourseId` (EMPTY) | → | `GENTypes.Id` |
| `GENCertification_Requests.CourseId` (EMPTY) | → | `GENTypes.Id` |
| `GENFileAttachments.CourseId` (EMPTY) | → | `GENTypes.Id` |
| `GENRawDatas.TypeId` (EMPTY) | → | `GENTypes.Id` |
| `GENTCRs.TypeId` (EMPTY) | → | `GENTypes.Id` |
| `ImportLogDatas.TypeId` (EMPTY) | → | `GENTypes.Id` |

### `GENItems` — 5,180 rows

**Depends on (outgoing FKs):**

| From | | To |
|------|--|----|
| `GENItems.DeletedById` | → | `AspNetUsers.Id` |
| `GENItems.BrandId` | → | `GENBrands.Id` |
| `GENItems.ClassificationId` | → | `GENClassifications.Id` |
| `GENItems.CompanyId` | → | `GENCompanies.Id` |
| `GENItems.OwnerId` | → | `GENContacts.Id` |
| `GENItems.OriginId` | → | `GENCountries.Id` |
| `GENItems.ExtListValue1Id` | → | `GENListValues.Id` |
| `GENItems.ValueId1` | → | `GENListValues.Id` |
| `GENItems.ValueId2` | → | `GENListValues.Id` |
| `GENItems.ValueId3` | → | `GENListValues.Id` |
| `GENItems.ValueId4` | → | `GENListValues.Id` |
| `GENItems.ValueId5` | → | `GENListValues.Id` |
| `GENItems.ProjectId` | → | `GENProjects.Id` (EMPTY) |
| `GENItems.IconId` | → | `GENStyles.Id` |
| `GENItems.TypeId` | → | `GENTypes.Id` |
| `GENItems.UnitId` | → | `GENUnits.Id` |

**Referenced by (incoming FKs):**

| From | | To |
|------|--|----|
| `Classroom_Attendance.SessionId` | → | `GENItems.Id` |
| `TLMSClassroom_Session.SessionId` | → | `GENItems.Id` |
| `Course_Session.SessionId` | → | `GENItems.Id` |
| `GENOrderDetails.ItemId` | → | `GENItems.Id` |
| `GENItemFiles.ItemId` | → | `GENItems.Id` |
| `GENItemVideos.ItemId` | → | `GENItems.Id` |
| `Zoom_Session.SessionId` | → | `GENItems.Id` |
| `GENSections.ItemId` | → | `GENItems.Id` |
| `GENExam_GENItem.SessionId` | → | `GENItems.Id` |
| `CRMDealItems.ItemId` (EMPTY) | → | `GENItems.Id` |
| `CRMQuoteItems.ItemId` (EMPTY) | → | `GENItems.Id` |
| `CRMSRVTicket_Comment.ItemId` (EMPTY) | → | `GENItems.Id` |
| `CRMSRVTicket_ItemAttachment.ItemAttachmentId` (EMPTY) | → | `GENItems.Id` |
| `CRMSRVTicket_Sparepart.ItemId` (EMPTY) | → | `GENItems.Id` |
| `CRMSRVTickets.ItemId` (EMPTY) | → | `GENItems.Id` |
| `CRMTickets.ItemId` (EMPTY) | → | `GENItems.Id` |
| `GENFileAttachments.ItemId` (EMPTY) | → | `GENItems.Id` |
| `GENItemAttachments.ItemId` (EMPTY) | → | `GENItems.Id` |
| `GENItemAudios.ItemId` (EMPTY) | → | `GENItems.Id` |
| `GENItemCategory_Item.ItemId` (EMPTY) | → | `GENItems.Id` |
| `GENItemCompetitions.ItemId` (EMPTY) | → | `GENItems.Id` |
| `GENItemDetails.ItemId` (EMPTY) | → | `GENItems.Id` |
| `GENItemGroup_Item.ItemId` (EMPTY) | → | `GENItems.Id` |
| `GENItemImages.ItemId` (EMPTY) | → | `GENItems.Id` |
| `GENItemPackings.ItemId` (EMPTY) | → | `GENItems.Id` |
| `GENItemPromotions.ItemId` (EMPTY) | → | `GENItems.Id` |
| `GENItemTags.ItemId` (EMPTY) | → | `GENItems.Id` |
| `GENItemToItemPointers.ItemId` (EMPTY) | → | `GENItems.Id` |
| `GENItem_Bundle.ItemId` (EMPTY) | → | `GENItems.Id` |
| `GENItem_Link.ItemId` (EMPTY) | → | `GENItems.Id` |
| `GENItem_Sessions.DependencySessionId` (EMPTY) | → | `GENItems.Id` |
| `GENItem_Sessions.MainSessionId` (EMPTY) | → | `GENItems.Id` |
| `GENItem_Specification.ItemId` (EMPTY) | → | `GENItems.Id` |
| `GENTranslate_Items.ItemId` (EMPTY) | → | `GENItems.Id` |
| `GENUserLikes.ItemId` (EMPTY) | → | `GENItems.Id` |
| `Items_Generic.ItemId` (EMPTY) | → | `GENItems.Id` |
| `TCRItems.ItemId` (EMPTY) | → | `GENItems.Id` |
| `TCRWorkItems.ItemId` (EMPTY) | → | `GENItems.Id` |

### `Course_Session` — 4,041 rows

**Depends on (outgoing FKs):**

| From | | To |
|------|--|----|
| `Course_Session.SessionId` | → | `GENItems.Id` |
| `Course_Session.CourseId` | → | `GENTypes.Id` |

### `GENClassrooms` — 2,996 rows

**Depends on (outgoing FKs):**

| From | | To |
|------|--|----|
| `GENClassrooms.DeletedById` | → | `AspNetUsers.Id` |
| `GENClassrooms.CityId` | → | `GENCities.Id` |
| `GENClassrooms.ClassroomCategoryId` | → | `GENClassroomCategories.Id` |
| `GENClassrooms.CompanyId` | → | `GENCompanies.Id` |
| `GENClassrooms.DestinationsId` | → | `GENCompanies.Id` |
| `GENClassrooms.OrganizationId` | → | `GENCompanies.Id` |
| `GENClassrooms.CountryId` | → | `GENCountries.Id` |
| `GENClassrooms.CurrencyId` | → | `GENCurrencies.Id` |
| `GENClassrooms.InstructorId` | → | `GENEmployees.Id` |
| `GENClassrooms.GovernorateId` | → | `GENGovernorates.Id` |
| `GENClassrooms.EventTypeId` | → | `GENListValues.Id` |
| `GENClassrooms.LanguageId` | → | `GENListValues.Id` |
| `GENClassrooms.ValueId1` | → | `GENListValues.Id` |
| `GENClassrooms.ValueId2` | → | `GENListValues.Id` |
| `GENClassrooms.ValueId3` | → | `GENListValues.Id` |
| `GENClassrooms.ValueId4` | → | `GENListValues.Id` |
| `GENClassrooms.ValueId5` | → | `GENListValues.Id` |
| `GENClassrooms.ExamId` | → | `GENPollCategories.Id` |
| `GENClassrooms.RoomId` | → | `GENRooms.Id` |
| `GENClassrooms.IconId` | → | `GENStyles.Id` |
| `GENClassrooms.CourseId` | → | `GENTypes.Id` |
| `GENClassrooms.WikiId` | → | `GENWikis.Id` |

**Referenced by (incoming FKs):**

| From | | To |
|------|--|----|
| `Classroom_Attendance.ClassroomId` | → | `GENClassrooms.Id` |
| `GENClassroom_GENContact.ClassroomId` | → | `GENClassrooms.Id` |
| `Contacts_Courses.ClassRoomId` | → | `GENClassrooms.Id` |
| `TLMSClassroom_Session.ClassroomId` | → | `GENClassrooms.Id` |
| `GENExamAnswerHeaders.ClassroomId` | → | `GENClassrooms.Id` |
| `GENFeedBacks.ClassroomId` | → | `GENClassrooms.Id` |
| `GENContactProgressCompletions.ClassroomId` | → | `GENClassrooms.Id` |
| `GENOrders.VcrId` | → | `GENClassrooms.Id` |
| `GENExam_GENClassroom.ClassroomId` | → | `GENClassrooms.Id` |
| `GENTalents_Generic.VcrId` | → | `GENClassrooms.Id` |
| `RandomNumberVCRLogs.VCRId` | → | `GENClassrooms.Id` |
| `Zoom_Session.VcrId` | → | `GENClassrooms.Id` |
| `GENCertification_Requests.ClassroomId` (EMPTY) | → | `GENClassrooms.Id` |
| `GENFileAttachments.ClassroomId` (EMPTY) | → | `GENClassrooms.Id` |
| `GENTranslate_ClassRoom.ClassRoomId` (EMPTY) | → | `GENClassrooms.Id` |

### `GENClassroom_GENContact` — 63,951 rows

**Depends on (outgoing FKs):**

| From | | To |
|------|--|----|
| `GENClassroom_GENContact.ClassroomId` | → | `GENClassrooms.Id` |
| `GENClassroom_GENContact.StudentId` | → | `GENContacts.Id` |
| `GENClassroom_GENContact.VoucherId` | → | `GENDiscountCards.Id` |

### `Contacts_Courses` — 44,931 rows

**Depends on (outgoing FKs):**

| From | | To |
|------|--|----|
| `Contacts_Courses.ClassRoomId` | → | `GENClassrooms.Id` |
| `Contacts_Courses.StudentId` | → | `GENContacts.Id` |
| `Contacts_Courses.OrderId` | → | `GENOrders.Id` |
| `Contacts_Courses.TalentId` | → | `GENTalents.Id` |
| `Contacts_Courses.CourseId` | → | `GENTypes.Id` |

### `TLMSClassroom_Session` — 25,268 rows

**Depends on (outgoing FKs):**

| From | | To |
|------|--|----|
| `TLMSClassroom_Session.ClassroomId` | → | `GENClassrooms.Id` |
| `TLMSClassroom_Session.InstructorId` | → | `GENEmployees.Id` |
| `TLMSClassroom_Session.SessionId` | → | `GENItems.Id` |

**Referenced by (incoming FKs):**

| From | | To |
|------|--|----|
| `Classroom_Session_Instructor.SessionId` | → | `TLMSClassroom_Session.Id` |
| `OTP_Attendance.TLMSClassroom_SessionId` | → | `TLMSClassroom_Session.Id` |

### `Classroom_Attendance` — 426,960 rows

**Depends on (outgoing FKs):**

| From | | To |
|------|--|----|
| `Classroom_Attendance.ClassroomId` | → | `GENClassrooms.Id` |
| `Classroom_Attendance.StudentId` | → | `GENContacts.Id` |
| `Classroom_Attendance.SessionId` | → | `GENItems.Id` |
| `Classroom_Attendance.ExecuseId` | → | `GENListValues.Id` |

### `OTP_Attendance` — 224 rows

**Depends on (outgoing FKs):**

| From | | To |
|------|--|----|
| `OTP_Attendance.InstructorId` | → | `GENEmployees.Id` |
| `OTP_Attendance.TLMSClassroom_SessionId` | → | `TLMSClassroom_Session.Id` |

### `Zoom_Session` — 18 rows

**Depends on (outgoing FKs):**

| From | | To |
|------|--|----|
| `Zoom_Session.VcrId` | → | `GENClassrooms.Id` |
| `Zoom_Session.SessionId` | → | `GENItems.Id` |
| `Zoom_Session.TalentId` | → | `GENTalents.Id` |
| `Zoom_Session.CourseId` | → | `GENTypes.Id` |

### `GENPollCategories` — 65 rows

**Depends on (outgoing FKs):**

| From | | To |
|------|--|----|
| `GENPollCategories.ExamAutoGeneratorId` | → | `GENExamAutoGenerators.Id` (EMPTY) |
| `GENPollCategories.LanguageId` | → | `GENListValues.Id` |
| `GENPollCategories.ValueId1` | → | `GENListValues.Id` |
| `GENPollCategories.ValueId2` | → | `GENListValues.Id` |
| `GENPollCategories.ValueId3` | → | `GENListValues.Id` |
| `GENPollCategories.ValueId4` | → | `GENListValues.Id` |
| `GENPollCategories.ValueId5` | → | `GENListValues.Id` |
| `GENPollCategories.IconId` | → | `GENStyles.Id` |

**Referenced by (incoming FKs):**

| From | | To |
|------|--|----|
| `GENExamAnswerHeaders.ExamId` | → | `GENPollCategories.Id` |
| `GENClassrooms.ExamId` | → | `GENPollCategories.Id` |
| `GENExam_GENClassroom.ExamId` | → | `GENPollCategories.Id` |
| `PollCategoryandPolls.PollCategoryId` | → | `GENPollCategories.Id` |
| `GENExam_GENType.ExamId` | → | `GENPollCategories.Id` |
| `GENExam_GENItem.ExamId` | → | `GENPollCategories.Id` |
| `GENExam_GENTalent.ExamId` (EMPTY) | → | `GENPollCategories.Id` |
| `GENExam_Generic.ExamId` (EMPTY) | → | `GENPollCategories.Id` |
| `GENTranslate_PollCategory.PollCategoryId` (EMPTY) | → | `GENPollCategories.Id` |

### `GENPolls` — 734 rows

**Depends on (outgoing FKs):**

| From | | To |
|------|--|----|
| `GENPolls.LanguageId` | → | `GENListValues.Id` |
| `GENPolls.ValueId1` | → | `GENListValues.Id` |
| `GENPolls.ValueId2` | → | `GENListValues.Id` |
| `GENPolls.ValueId3` | → | `GENListValues.Id` |
| `GENPolls.ValueId4` | → | `GENListValues.Id` |
| `GENPolls.ValueId5` | → | `GENListValues.Id` |
| `GENPolls.IconId` | → | `GENStyles.Id` |

**Referenced by (incoming FKs):**

| From | | To |
|------|--|----|
| `GENExamAnswerDetails.PollId` | → | `GENPolls.Id` |
| `GENPollAnswers.PollId` | → | `GENPolls.Id` |
| `PollCategoryandPolls.PollId` | → | `GENPolls.Id` |
| `Course_Question.QuestionId` (EMPTY) | → | `GENPolls.Id` |
| `GENTranslate_Poll.PollId` (EMPTY) | → | `GENPolls.Id` |

### `GENPollAnswers` — 1,876 rows

**Depends on (outgoing FKs):**

| From | | To |
|------|--|----|
| `GENPollAnswers.ValueId1` | → | `GENListValues.Id` |
| `GENPollAnswers.ValueId2` | → | `GENListValues.Id` |
| `GENPollAnswers.ValueId3` | → | `GENListValues.Id` |
| `GENPollAnswers.ValueId4` | → | `GENListValues.Id` |
| `GENPollAnswers.ValueId5` | → | `GENListValues.Id` |
| `GENPollAnswers.PollId` | → | `GENPolls.Id` |
| `GENPollAnswers.IconId` | → | `GENStyles.Id` |

**Referenced by (incoming FKs):**

| From | | To |
|------|--|----|
| `GENExamAnswerDetails.PollAnswerId` | → | `GENPollAnswers.Id` |
| `GENTranslate_PollAnswer.PollAnswerId` (EMPTY) | → | `GENPollAnswers.Id` |

### `PollCategoryandPolls` — 1,202 rows

**Depends on (outgoing FKs):**

| From | | To |
|------|--|----|
| `PollCategoryandPolls.ValueId1` | → | `GENListValues.Id` |
| `PollCategoryandPolls.ValueId2` | → | `GENListValues.Id` |
| `PollCategoryandPolls.ValueId3` | → | `GENListValues.Id` |
| `PollCategoryandPolls.ValueId4` | → | `GENListValues.Id` |
| `PollCategoryandPolls.ValueId5` | → | `GENListValues.Id` |
| `PollCategoryandPolls.PollCategoryId` | → | `GENPollCategories.Id` |
| `PollCategoryandPolls.PollId` | → | `GENPolls.Id` |
| `PollCategoryandPolls.QuestionGroupId` | → | `GENQuestionGroups.Id` |
| `PollCategoryandPolls.IconId` | → | `GENStyles.Id` |

### `GENExamAnswerHeaders` — 17,156 rows

**Depends on (outgoing FKs):**

| From | | To |
|------|--|----|
| `GENExamAnswerHeaders.ClassroomId` | → | `GENClassrooms.Id` |
| `GENExamAnswerHeaders.StudentId` | → | `GENContacts.Id` |
| `GENExamAnswerHeaders.InstructorId` | → | `GENEmployees.Id` |
| `GENExamAnswerHeaders.ValueId1` | → | `GENListValues.Id` |
| `GENExamAnswerHeaders.ValueId2` | → | `GENListValues.Id` |
| `GENExamAnswerHeaders.ValueId3` | → | `GENListValues.Id` |
| `GENExamAnswerHeaders.ValueId4` | → | `GENListValues.Id` |
| `GENExamAnswerHeaders.ValueId5` | → | `GENListValues.Id` |
| `GENExamAnswerHeaders.ExamId` | → | `GENPollCategories.Id` |
| `GENExamAnswerHeaders.IconId` | → | `GENStyles.Id` |
| `GENExamAnswerHeaders.CourseId` | → | `GENTypes.Id` |

**Referenced by (incoming FKs):**

| From | | To |
|------|--|----|
| `GENExamAnswerDetails.ExamAnswerHeaderId` | → | `GENExamAnswerHeaders.Id` |

### `GENExamAnswerDetails` — 99,737 rows

**Depends on (outgoing FKs):**

| From | | To |
|------|--|----|
| `GENExamAnswerDetails.ExamAnswerHeaderId` | → | `GENExamAnswerHeaders.Id` |
| `GENExamAnswerDetails.PollAnswerId` | → | `GENPollAnswers.Id` |
| `GENExamAnswerDetails.PollId` | → | `GENPolls.Id` |

### `GENExam_GENClassroom` — 1,213 rows

**Depends on (outgoing FKs):**

| From | | To |
|------|--|----|
| `GENExam_GENClassroom.ClassroomId` | → | `GENClassrooms.Id` |
| `GENExam_GENClassroom.ExamId` | → | `GENPollCategories.Id` |

### `GENCertificates` — 46,086 rows

**Depends on (outgoing FKs):**

| From | | To |
|------|--|----|
| `GENCertificates.ContactId` | → | `GENContacts.Id` |
| `GENCertificates.TemplateId` | → | `GENWikis.Id` |

### `GENContactProgressCompletions` — 8,073 rows

**Depends on (outgoing FKs):**

| From | | To |
|------|--|----|
| `GENContactProgressCompletions.BaseEntityId` | → | `BaseEntities.Id` |
| `GENContactProgressCompletions.ClassroomId` | → | `GENClassrooms.Id` |
| `GENContactProgressCompletions.ContactId` | → | `GENContacts.Id` |
| `GENContactProgressCompletions.CourseId` | → | `GENTypes.Id` |

**Referenced by (incoming FKs):**

| From | | To |
|------|--|----|
| `GENContactProgressCompletionDetails.ContactProgressCompletionId` | → | `GENContactProgressCompletions.Id` |

### `GENOrders` — 3,701 rows

**Depends on (outgoing FKs):**

| From | | To |
|------|--|----|
| `GENOrders.UserAddressId` | → | `AspNetUserAddresses.Id` (EMPTY) |
| `GENOrders.UserId` | → | `AspNetUsers.Id` |
| `GENOrders.BranchId` | → | `GENBranches.Id` |
| `GENOrders.CertificationRequestId` | → | `GENCertification_Requests.Id` (EMPTY) |
| `GENOrders.VcrId` | → | `GENClassrooms.Id` |
| `GENOrders.ContactId` | → | `GENContacts.Id` |
| `GENOrders.CurrencyId` | → | `GENCurrencies.Id` |
| `GENOrders.ValueId1` | → | `GENListValues.Id` |
| `GENOrders.ValueId2` | → | `GENListValues.Id` |
| `GENOrders.ValueId3` | → | `GENListValues.Id` |
| `GENOrders.ValueId4` | → | `GENListValues.Id` |
| `GENOrders.ValueId5` | → | `GENListValues.Id` |
| `GENOrders.OrderCategoryId` | → | `GENOrderCategories.Id` (EMPTY) |
| `GENOrders.StatusId` | → | `GENStatus.Id` |
| `GENOrders.IconId` | → | `GENStyles.Id` |
| `GENOrders.TalentId` | → | `GENTalents.Id` |
| `GENOrders.TypeId` | → | `GENTypes.Id` |

**Referenced by (incoming FKs):**

| From | | To |
|------|--|----|
| `Contacts_Courses.OrderId` | → | `GENOrders.Id` |
| `GENOrderDetails.OrderId` | → | `GENOrders.Id` |
| `GENReturnedOrders.OrderId` | → | `GENOrders.Id` |
| `GENPaymentTransactions.OrderId` (EMPTY) | → | `GENOrders.Id` |

### `GENOrderDetails` — 3,701 rows

**Depends on (outgoing FKs):**

| From | | To |
|------|--|----|
| `GENOrderDetails.BaseEntityId` | → | `BaseEntities.Id` |
| `GENOrderDetails.CurrencyId` | → | `GENCurrencies.Id` |
| `GENOrderDetails.ItemId` | → | `GENItems.Id` |
| `GENOrderDetails.OrderId` | → | `GENOrders.Id` |
| `GENOrderDetails.UnitId` | → | `GENUnits.Id` |

**Referenced by (incoming FKs):**

| From | | To |
|------|--|----|
| `GENOrderDetailSpecs.OrderDetailId` (EMPTY) | → | `GENOrderDetails.Id` |

### `GENFeedBacks` — 10,810 rows

**Depends on (outgoing FKs):**

| From | | To |
|------|--|----|
| `GENFeedBacks.BranchId` | → | `GENBranches.Id` |
| `GENFeedBacks.BrandId` | → | `GENBrands.Id` |
| `GENFeedBacks.ClassroomId` | → | `GENClassrooms.Id` |
| `GENFeedBacks.EmployeeId` | → | `GENEmployees.Id` |
| `GENFeedBacks.FeedBackCategoryId` | → | `GENFeedBackCategories.Id` |
| `GENFeedBacks.ValueId1` | → | `GENListValues.Id` |
| `GENFeedBacks.ValueId2` | → | `GENListValues.Id` |
| `GENFeedBacks.ValueId3` | → | `GENListValues.Id` |
| `GENFeedBacks.ValueId4` | → | `GENListValues.Id` |
| `GENFeedBacks.ValueId5` | → | `GENListValues.Id` |
| `GENFeedBacks.StatusId` | → | `GENStatus.Id` |
| `GENFeedBacks.IconId` | → | `GENStyles.Id` |
| `GENFeedBacks.CourseId` | → | `GENTypes.Id` |

**Referenced by (incoming FKs):**

| From | | To |
|------|--|----|
| `GENTranslate_FeedBack.FeedBackId` (EMPTY) | → | `GENFeedBacks.Id` |

### `GENFileAttachments` — EMPTY

**Depends on (outgoing FKs):**

| From | | To |
|------|--|----|
| `GENFileAttachments.BaseEntityId` | → | `BaseEntities.Id` |
| `GENFileAttachments.BrandId` | → | `GENBrands.Id` |
| `GENFileAttachments.ClassroomId` | → | `GENClassrooms.Id` |
| `GENFileAttachments.EmployeeId` | → | `GENEmployees.Id` |
| `GENFileAttachments.CategoryId` | → | `GENItemCategories.Id` |
| `GENFileAttachments.ItemId` | → | `GENItems.Id` |
| `GENFileAttachments.ValueId1` | → | `GENListValues.Id` |
| `GENFileAttachments.ValueId2` | → | `GENListValues.Id` |
| `GENFileAttachments.ValueId3` | → | `GENListValues.Id` |
| `GENFileAttachments.ValueId4` | → | `GENListValues.Id` |
| `GENFileAttachments.ValueId5` | → | `GENListValues.Id` |
| `GENFileAttachments.SectionId` | → | `GENSections.Id` |
| `GENFileAttachments.IconId` | → | `GENStyles.Id` |
| `GENFileAttachments.TalentId` | → | `GENTalents.Id` |
| `GENFileAttachments.CourseId` | → | `GENTypes.Id` |

**Referenced by (incoming FKs):**

| From | | To |
|------|--|----|
| `GENTranslate_FileAttachment.FileAttachId` (EMPTY) | → | `GENFileAttachments.Id` |

### `GENRooms` — 47 rows

**Depends on (outgoing FKs):**

| From | | To |
|------|--|----|
| `GENRooms.IconId` | → | `GENStyles.Id` |

**Referenced by (incoming FKs):**

| From | | To |
|------|--|----|
| `GENClassrooms.RoomId` | → | `GENRooms.Id` |

### `GENCities` — 28 rows

**Depends on (outgoing FKs):**

| From | | To |
|------|--|----|
| `GENCities.CityCategoryId` | → | `GENCityCategories.Id` (EMPTY) |
| `GENCities.GovernorateId` | → | `GENGovernorates.Id` |
| `GENCities.ValueId1` | → | `GENListValues.Id` |
| `GENCities.ValueId2` | → | `GENListValues.Id` |
| `GENCities.ValueId3` | → | `GENListValues.Id` |
| `GENCities.ValueId4` | → | `GENListValues.Id` |
| `GENCities.ValueId5` | → | `GENListValues.Id` |
| `GENCities.IconId` | → | `GENStyles.Id` |

**Referenced by (incoming FKs):**

| From | | To |
|------|--|----|
| `GENPushNotifications.PlaceId` | → | `GENCities.Id` |
| `GENAddresses.CityId` | → | `GENCities.Id` |
| `GENClassrooms.CityId` | → | `GENCities.Id` |
| `GENPushNotificationArchives.PlaceId` | → | `GENCities.Id` |
| `GENTranslate_City.CityId` | → | `GENCities.Id` |
| `GENDistricts.CityId` | → | `GENCities.Id` |
| `AspNetUserAddresses.CityId` (EMPTY) | → | `GENCities.Id` |
| `CRMSRVRequesterAddresses.CityId` (EMPTY) | → | `GENCities.Id` |
| `GENCompanyAddresses.CityId` (EMPTY) | → | `GENCities.Id` |
| `GENContactAddresses.CityId` (EMPTY) | → | `GENCities.Id` |
| `GENRegions1.CityId` (EMPTY) | → | `GENCities.Id` |

### `GENCountries` — 174 rows

**Depends on (outgoing FKs):**

| From | | To |
|------|--|----|
| `GENCountries.CountryCategoryId` | → | `GENCountryCategories.Id` (EMPTY) |
| `GENCountries.ValueId1` | → | `GENListValues.Id` |
| `GENCountries.ValueId2` | → | `GENListValues.Id` |
| `GENCountries.ValueId3` | → | `GENListValues.Id` |
| `GENCountries.ValueId4` | → | `GENListValues.Id` |
| `GENCountries.ValueId5` | → | `GENListValues.Id` |
| `GENCountries.RegionsId` | → | `GENRegions.Id` |
| `GENCountries.IconId` | → | `GENStyles.Id` |

**Referenced by (incoming FKs):**

| From | | To |
|------|--|----|
| `GENAddresses.CountryId` | → | `GENCountries.Id` |
| `GENItems.OriginId` | → | `GENCountries.Id` |
| `GENClassrooms.CountryId` | → | `GENCountries.Id` |
| `GENTranslate_Country.CountryId` | → | `GENCountries.Id` |
| `GENProvinces.CountryId` | → | `GENCountries.Id` |
| `AspNetUserAddresses.CountryId` (EMPTY) | → | `GENCountries.Id` |
| `CRMSRVRequesterAddresses.CountryId` (EMPTY) | → | `GENCountries.Id` |
| `GENCompanyAddresses.CountryId` (EMPTY) | → | `GENCountries.Id` |
| `GENContactAddresses.CountryId` (EMPTY) | → | `GENCountries.Id` |

### `GENGovernorates` — 9 rows

**Depends on (outgoing FKs):**

| From | | To |
|------|--|----|
| `GENGovernorates.ValueId1` | → | `GENListValues.Id` |
| `GENGovernorates.ValueId2` | → | `GENListValues.Id` |
| `GENGovernorates.ValueId3` | → | `GENListValues.Id` |
| `GENGovernorates.ValueId4` | → | `GENListValues.Id` |
| `GENGovernorates.ValueId5` | → | `GENListValues.Id` |
| `GENGovernorates.ProvinceId` | → | `GENProvinces.Id` |
| `GENGovernorates.IconId` | → | `GENStyles.Id` |

**Referenced by (incoming FKs):**

| From | | To |
|------|--|----|
| `GENContacts.GovernorateId` | → | `GENGovernorates.Id` |
| `GENAddresses.GovernorateId` | → | `GENGovernorates.Id` |
| `GENClassrooms.GovernorateId` | → | `GENGovernorates.Id` |
| `GENCities.GovernorateId` | → | `GENGovernorates.Id` |
| `AspNetUserAddresses.GovernorateId` (EMPTY) | → | `GENGovernorates.Id` |
| `GENPerson_Details.GovernorateId` (EMPTY) | → | `GENGovernorates.Id` |
| `GENTranslate_Governorate.GovernorateId` (EMPTY) | → | `GENGovernorates.Id` |

### `GENCurrencies` — 2 rows

**Depends on (outgoing FKs):**

| From | | To |
|------|--|----|
| `GENCurrencies.CurrencyCategoryId` | → | `GENCurrencyCategories.Id` (EMPTY) |
| `GENCurrencies.ValueId1` | → | `GENListValues.Id` |
| `GENCurrencies.ValueId2` | → | `GENListValues.Id` |
| `GENCurrencies.ValueId3` | → | `GENListValues.Id` |
| `GENCurrencies.ValueId4` | → | `GENListValues.Id` |
| `GENCurrencies.ValueId5` | → | `GENListValues.Id` |
| `GENCurrencies.IconId` | → | `GENStyles.Id` |

**Referenced by (incoming FKs):**

| From | | To |
|------|--|----|
| `Classroom_Session_Instructor.CurrencyId` | → | `GENCurrencies.Id` |
| `GENCompanies.CurrencyId` | → | `GENCurrencies.Id` |
| `GENOrderDetails.CurrencyId` | → | `GENCurrencies.Id` |
| `GENOrders.CurrencyId` | → | `GENCurrencies.Id` |
| `GENClassrooms.CurrencyId` | → | `GENCurrencies.Id` |
| `GENEntityPricings.CurrencyId` | → | `GENCurrencies.Id` |
| `CompanyLogDatas.CurrencyId` | → | `GENCurrencies.Id` |
| `CRMDeals.CurrencyId` (EMPTY) | → | `GENCurrencies.Id` |
| `CRMQuotes.DealCurrencyId` (EMPTY) | → | `GENCurrencies.Id` |
| `CRMTickets.CurrencyId` (EMPTY) | → | `GENCurrencies.Id` |
| `GENTCRs.DealCurrencyId` (EMPTY) | → | `GENCurrencies.Id` |
| `GENTranslate_Currency.CurrencyId` (EMPTY) | → | `GENCurrencies.Id` |

### `GENListValues` — 3,328 rows

**Depends on (outgoing FKs):**

| From | | To |
|------|--|----|
| `GENListValues.ValueId1` | → | `GENListValues.Id` |
| `GENListValues.ValueId2` | → | `GENListValues.Id` |
| `GENListValues.ValueId3` | → | `GENListValues.Id` |
| `GENListValues.ValueId4` | → | `GENListValues.Id` |
| `GENListValues.ValueId5` | → | `GENListValues.Id` |
| `GENListValues.GENListValuesTypeId` | → | `GENListValuesTypes.Id` |
| `GENListValues.GENListValuesType_Id` | → | `GENListValuesTypes.Id` |
| `GENListValues.IconId` | → | `GENStyles.Id` |

**Referenced by (incoming FKs):**

| From | | To |
|------|--|----|
| `Classroom_Attendance.ExecuseId` | → | `GENListValues.Id` |
| `GENPushNotifications.LangId` | → | `GENListValues.Id` |
| `GENPushNotifications.ValueId1` | → | `GENListValues.Id` |
| `GENPushNotifications.ValueId10` | → | `GENListValues.Id` |
| `GENPushNotifications.ValueId11` | → | `GENListValues.Id` |
| `GENPushNotifications.ValueId12` | → | `GENListValues.Id` |
| `GENPushNotifications.ValueId13` | → | `GENListValues.Id` |
| `GENPushNotifications.ValueId14` | → | `GENListValues.Id` |
| `GENPushNotifications.ValueId15` | → | `GENListValues.Id` |
| `GENPushNotifications.ValueId16` | → | `GENListValues.Id` |
| `GENPushNotifications.ValueId17` | → | `GENListValues.Id` |
| `GENPushNotifications.ValueId18` | → | `GENListValues.Id` |
| `GENPushNotifications.ValueId19` | → | `GENListValues.Id` |
| `GENPushNotifications.ValueId2` | → | `GENListValues.Id` |
| `GENPushNotifications.ValueId20` | → | `GENListValues.Id` |
| `GENPushNotifications.ValueId3` | → | `GENListValues.Id` |
| `GENPushNotifications.ValueId4` | → | `GENListValues.Id` |
| `GENPushNotifications.ValueId5` | → | `GENListValues.Id` |
| `GENPushNotifications.ValueId6` | → | `GENListValues.Id` |
| `GENPushNotifications.ValueId7` | → | `GENListValues.Id` |
| `GENPushNotifications.ValueId8` | → | `GENListValues.Id` |
| `GENPushNotifications.ValueId9` | → | `GENListValues.Id` |
| `GENContacts.AssessmentId` | → | `GENListValues.Id` |
| `GENContacts.BirthplaceId` | → | `GENListValues.Id` |
| `GENContacts.ClubId` | → | `GENListValues.Id` |
| `GENContacts.EmployerId` | → | `GENListValues.Id` |
| `GENContacts.GenderId` | → | `GENListValues.Id` |
| `GENContacts.IDNumberCheckId` | → | `GENListValues.Id` |
| `GENContacts.JobId` | → | `GENListValues.Id` |
| `GENContacts.LanguageId` | → | `GENListValues.Id` |
| `GENContacts.MartialStatusId` | → | `GENListValues.Id` |
| `GENContacts.NationalityId` | → | `GENListValues.Id` |
| `GENContacts.PositionRecruitmentId` | → | `GENListValues.Id` |
| `GENContacts.PriortyId` | → | `GENListValues.Id` |
| `GENContacts.QualificationId` | → | `GENListValues.Id` |
| `GENContacts.RelativeRelationId` | → | `GENListValues.Id` |
| `GENContacts.ReligionId` | → | `GENListValues.Id` |
| `GENContacts.RentPeriodId` | → | `GENListValues.Id` |
| `GENContacts.SocialStatusId` | → | `GENListValues.Id` |
| `GENContacts.TypeofPersonalizationId` | → | `GENListValues.Id` |
| `GENContacts.ValueId1` | → | `GENListValues.Id` |
| `GENContacts.ValueId2` | → | `GENListValues.Id` |
| `GENContacts.ValueId3` | → | `GENListValues.Id` |
| `GENContacts.ValueId4` | → | `GENListValues.Id` |
| `GENContacts.ValueId5` | → | `GENListValues.Id` |
| `GENAddresses.AddressTypeId` | → | `GENListValues.Id` |
| `GENFiles.FileTypeId` | → | `GENListValues.Id` |
| `GENFiles.LanguageId` | → | `GENListValues.Id` |
| `GENExamAnswerHeaders.ValueId1` | → | `GENListValues.Id` |
| `GENExamAnswerHeaders.ValueId2` | → | `GENListValues.Id` |
| `GENExamAnswerHeaders.ValueId3` | → | `GENListValues.Id` |
| `GENExamAnswerHeaders.ValueId4` | → | `GENListValues.Id` |
| `GENExamAnswerHeaders.ValueId5` | → | `GENListValues.Id` |
| `Classroom_Session_Instructor.JobId` | → | `GENListValues.Id` |
| `Classroom_Session_Instructor.LanguageId` | → | `GENListValues.Id` |
| `GENFeedBacks.ValueId1` | → | `GENListValues.Id` |
| `GENFeedBacks.ValueId2` | → | `GENListValues.Id` |
| `GENFeedBacks.ValueId3` | → | `GENListValues.Id` |
| `GENFeedBacks.ValueId4` | → | `GENListValues.Id` |
| `GENFeedBacks.ValueId5` | → | `GENListValues.Id` |
| `ContactLogDatas.ValueId1` | → | `GENListValues.Id` |
| `ContactLogDatas.ValueId2` | → | `GENListValues.Id` |
| `ContactLogDatas.ValueId3` | → | `GENListValues.Id` |
| `ContactLogDatas.ValueId4` | → | `GENListValues.Id` |
| `ContactLogDatas.ValueId5` | → | `GENListValues.Id` |
| `GENCompanies.ValueId1` | → | `GENListValues.Id` |
| `GENCompanies.ValueId2` | → | `GENListValues.Id` |
| `GENCompanies.ValueId3` | → | `GENListValues.Id` |
| `GENCompanies.ValueId4` | → | `GENListValues.Id` |
| `GENCompanies.ValueId5` | → | `GENListValues.Id` |
| `GENItems.ExtListValue1Id` | → | `GENListValues.Id` |
| `GENItems.ValueId1` | → | `GENListValues.Id` |
| `GENItems.ValueId2` | → | `GENListValues.Id` |
| `GENItems.ValueId3` | → | `GENListValues.Id` |
| `GENItems.ValueId4` | → | `GENListValues.Id` |
| `GENItems.ValueId5` | → | `GENListValues.Id` |
| `GENOrders.ValueId1` | → | `GENListValues.Id` |
| `GENOrders.ValueId2` | → | `GENListValues.Id` |
| `GENOrders.ValueId3` | → | `GENListValues.Id` |
| `GENOrders.ValueId4` | → | `GENListValues.Id` |
| `GENOrders.ValueId5` | → | `GENListValues.Id` |
| `GENListValues.ValueId1` | → | `GENListValues.Id` |
| `GENListValues.ValueId2` | → | `GENListValues.Id` |
| `GENListValues.ValueId3` | → | `GENListValues.Id` |
| `GENListValues.ValueId4` | → | `GENListValues.Id` |
| `GENListValues.ValueId5` | → | `GENListValues.Id` |
| `GENClassrooms.EventTypeId` | → | `GENListValues.Id` |
| `GENClassrooms.LanguageId` | → | `GENListValues.Id` |
| `GENClassrooms.ValueId1` | → | `GENListValues.Id` |
| `GENClassrooms.ValueId2` | → | `GENListValues.Id` |
| `GENClassrooms.ValueId3` | → | `GENListValues.Id` |
| `GENClassrooms.ValueId4` | → | `GENListValues.Id` |
| `GENClassrooms.ValueId5` | → | `GENListValues.Id` |
| `GENTranslate_PageOfPageFeilds.LangId` | → | `GENListValues.Id` |
| `GENPollAnswers.ValueId1` | → | `GENListValues.Id` |
| `GENPollAnswers.ValueId2` | → | `GENListValues.Id` |
| `GENPollAnswers.ValueId3` | → | `GENListValues.Id` |
| `GENPollAnswers.ValueId4` | → | `GENListValues.Id` |
| `GENPollAnswers.ValueId5` | → | `GENListValues.Id` |
| `GENImages.LanguageId` | → | `GENListValues.Id` |
| `GENTranslate_Wiki.LangId` | → | `GENListValues.Id` |
| `GENItemFiles.LanguageId` | → | `GENListValues.Id` |
| `PollCategoryandPolls.ValueId1` | → | `GENListValues.Id` |
| `PollCategoryandPolls.ValueId2` | → | `GENListValues.Id` |
| `PollCategoryandPolls.ValueId3` | → | `GENListValues.Id` |
| `PollCategoryandPolls.ValueId4` | → | `GENListValues.Id` |
| `PollCategoryandPolls.ValueId5` | → | `GENListValues.Id` |
| `GENTranslate_PageOfPageRelation.LangId` | → | `GENListValues.Id` |
| `GENEmployees.GenderId` | → | `GENListValues.Id` |
| `GENEmployees.JobCategoryId` | → | `GENListValues.Id` |
| `GENEmployees.Language1Id` | → | `GENListValues.Id` |
| `GENEmployees.Language2Id` | → | `GENListValues.Id` |
| `GENEmployees.MartialStatusId` | → | `GENListValues.Id` |
| `GENEmployees.MilitaryStatusId` | → | `GENListValues.Id` |
| `GENEmployees.QualificationId` | → | `GENListValues.Id` |
| `GENEmployees.ValueId1` | → | `GENListValues.Id` |
| `GENEmployees.ValueId2` | → | `GENListValues.Id` |
| `GENEmployees.ValueId3` | → | `GENListValues.Id` |
| `GENEmployees.ValueId4` | → | `GENListValues.Id` |
| `GENEmployees.ValueId5` | → | `GENListValues.Id` |
| `GENPolls.LanguageId` | → | `GENListValues.Id` |
| `GENPolls.ValueId1` | → | `GENListValues.Id` |
| `GENPolls.ValueId2` | → | `GENListValues.Id` |
| `GENPolls.ValueId3` | → | `GENListValues.Id` |
| `GENPolls.ValueId4` | → | `GENListValues.Id` |
| `GENPolls.ValueId5` | → | `GENListValues.Id` |
| `GENWikis.ValueId1` | → | `GENListValues.Id` |
| `GENWikis.ValueId2` | → | `GENListValues.Id` |
| `GENWikis.ValueId3` | → | `GENListValues.Id` |
| `GENWikis.ValueId4` | → | `GENListValues.Id` |
| `GENWikis.ValueId5` | → | `GENListValues.Id` |
| `GENEntityPricings.LanguageId` | → | `GENListValues.Id` |
| `GENItemVideos.LanguageId` | → | `GENListValues.Id` |
| `GENTypes.LanguageId` | → | `GENListValues.Id` |
| `GENTypes.ValueId1` | → | `GENListValues.Id` |
| `GENTypes.ValueId2` | → | `GENListValues.Id` |
| `GENTypes.ValueId3` | → | `GENListValues.Id` |
| `GENTypes.ValueId4` | → | `GENListValues.Id` |
| `GENTypes.ValueId5` | → | `GENListValues.Id` |
| `GENTranslate_Country.LangId` | → | `GENListValues.Id` |
| `GENTranslate_BackendPage.LangId` | → | `GENListValues.Id` |
| `BaseTabFields.FieldTypeId` | → | `GENListValues.Id` |
| `GENTranslate_Type.LangId` | → | `GENListValues.Id` |
| `AchievementsOpenBals.ListOfValueId` | → | `GENListValues.Id` |
| `GENBackendPages.TextAlignId` | → | `GENListValues.Id` |
| `GENPushNotificationArchives.LangId` | → | `GENListValues.Id` |
| `GENPushNotificationArchives.ValueId1` | → | `GENListValues.Id` |
| `GENPushNotificationArchives.ValueId10` | → | `GENListValues.Id` |
| `GENPushNotificationArchives.ValueId11` | → | `GENListValues.Id` |
| `GENPushNotificationArchives.ValueId12` | → | `GENListValues.Id` |
| `GENPushNotificationArchives.ValueId13` | → | `GENListValues.Id` |
| `GENPushNotificationArchives.ValueId14` | → | `GENListValues.Id` |
| `GENPushNotificationArchives.ValueId15` | → | `GENListValues.Id` |
| `GENPushNotificationArchives.ValueId16` | → | `GENListValues.Id` |
| `GENPushNotificationArchives.ValueId17` | → | `GENListValues.Id` |
| `GENPushNotificationArchives.ValueId18` | → | `GENListValues.Id` |
| `GENPushNotificationArchives.ValueId19` | → | `GENListValues.Id` |
| `GENPushNotificationArchives.ValueId2` | → | `GENListValues.Id` |
| `GENPushNotificationArchives.ValueId20` | → | `GENListValues.Id` |
| `GENPushNotificationArchives.ValueId3` | → | `GENListValues.Id` |
| `GENPushNotificationArchives.ValueId4` | → | `GENListValues.Id` |
| `GENPushNotificationArchives.ValueId5` | → | `GENListValues.Id` |
| `GENPushNotificationArchives.ValueId6` | → | `GENListValues.Id` |
| `GENPushNotificationArchives.ValueId7` | → | `GENListValues.Id` |
| `GENPushNotificationArchives.ValueId8` | → | `GENListValues.Id` |
| `GENPushNotificationArchives.ValueId9` | → | `GENListValues.Id` |
| `GENConfigurations.ValueId1` | → | `GENListValues.Id` |
| `GENConfigurations.ValueId2` | → | `GENListValues.Id` |
| `GENConfigurations.ValueId3` | → | `GENListValues.Id` |
| `GENConfigurations.ValueId4` | → | `GENListValues.Id` |
| `GENConfigurations.ValueId5` | → | `GENListValues.Id` |
| `GENCountries.ValueId1` | → | `GENListValues.Id` |
| `GENCountries.ValueId2` | → | `GENListValues.Id` |
| `GENCountries.ValueId3` | → | `GENListValues.Id` |
| `GENCountries.ValueId4` | → | `GENListValues.Id` |
| `GENCountries.ValueId5` | → | `GENListValues.Id` |
| `Translate_BaseTabs.LangId` | → | `GENListValues.Id` |
| `GENTranslate_ListValue.GENListValuesId` | → | `GENListValues.Id` |
| `GENTranslate_ListValue.LangId` | → | `GENListValues.Id` |
| `GENTranslate_TypeCategory.LangId` | → | `GENListValues.Id` |
| `GENTalents.ValueId1` | → | `GENListValues.Id` |
| `GENTalents.ValueId2` | → | `GENListValues.Id` |
| `GENTalents.ValueId3` | → | `GENListValues.Id` |
| `GENTalents.ValueId4` | → | `GENListValues.Id` |
| `GENTalents.ValueId5` | → | `GENListValues.Id` |
| `GENImageTypes.ValueId1` | → | `GENListValues.Id` |
| `GENImageTypes.ValueId2` | → | `GENListValues.Id` |
| `GENImageTypes.ValueId3` | → | `GENListValues.Id` |
| `GENImageTypes.ValueId4` | → | `GENListValues.Id` |
| `GENImageTypes.ValueId5` | → | `GENListValues.Id` |
| `GENWikiCategories.ValueId1` | → | `GENListValues.Id` |
| `GENWikiCategories.ValueId2` | → | `GENListValues.Id` |
| `GENWikiCategories.ValueId3` | → | `GENListValues.Id` |
| `GENWikiCategories.ValueId4` | → | `GENListValues.Id` |
| `GENWikiCategories.ValueId5` | → | `GENListValues.Id` |
| `CompanyLogDatas.ValueId1` | → | `GENListValues.Id` |
| `CompanyLogDatas.ValueId2` | → | `GENListValues.Id` |
| `CompanyLogDatas.ValueId3` | → | `GENListValues.Id` |
| `CompanyLogDatas.ValueId4` | → | `GENListValues.Id` |
| `CompanyLogDatas.ValueId5` | → | `GENListValues.Id` |
| `GENPollCategories.LanguageId` | → | `GENListValues.Id` |
| `GENPollCategories.ValueId1` | → | `GENListValues.Id` |
| `GENPollCategories.ValueId2` | → | `GENListValues.Id` |
| `GENPollCategories.ValueId3` | → | `GENListValues.Id` |
| `GENPollCategories.ValueId4` | → | `GENListValues.Id` |
| `GENPollCategories.ValueId5` | → | `GENListValues.Id` |
| `GENTranslate_WikiCategory.LangId` | → | `GENListValues.Id` |
| `GENEasyAccesses.ValueId1` | → | `GENListValues.Id` |
| `GENEasyAccesses.ValueId2` | → | `GENListValues.Id` |
| `GENEasyAccesses.ValueId3` | → | `GENListValues.Id` |
| `GENEasyAccesses.ValueId4` | → | `GENListValues.Id` |
| `GENEasyAccesses.ValueId5` | → | `GENListValues.Id` |
| `GENTranslate_City.LangId` | → | `GENListValues.Id` |
| `Reports.ValueId1` | → | `GENListValues.Id` |
| `Reports.ValueId2` | → | `GENListValues.Id` |
| `Reports.ValueId3` | → | `GENListValues.Id` |
| `Reports.ValueId4` | → | `GENListValues.Id` |
| `Reports.ValueId5` | → | `GENListValues.Id` |
| `CRMSentEmails.ValueId1` | → | `GENListValues.Id` |
| `CRMSentEmails.ValueId2` | → | `GENListValues.Id` |
| `CRMSentEmails.ValueId3` | → | `GENListValues.Id` |
| `CRMSentEmails.ValueId4` | → | `GENListValues.Id` |
| `CRMSentEmails.ValueId5` | → | `GENListValues.Id` |
| `GENListValuesTypes.ValueId1` | → | `GENListValues.Id` |
| `GENListValuesTypes.ValueId2` | → | `GENListValues.Id` |
| `GENListValuesTypes.ValueId3` | → | `GENListValues.Id` |
| `GENListValuesTypes.ValueId4` | → | `GENListValues.Id` |
| `GENListValuesTypes.ValueId5` | → | `GENListValues.Id` |
| `GENTalentBuilders.ValueId1` | → | `GENListValues.Id` |
| `GENTalentBuilders.ValueId2` | → | `GENListValues.Id` |
| `GENTalentBuilders.ValueId3` | → | `GENListValues.Id` |
| `GENTalentBuilders.ValueId4` | → | `GENListValues.Id` |
| `GENTalentBuilders.ValueId5` | → | `GENListValues.Id` |
| `GENTranslate_BackendPageSection.LangId` | → | `GENListValues.Id` |
| `GENCities.ValueId1` | → | `GENListValues.Id` |
| `GENCities.ValueId2` | → | `GENListValues.Id` |
| `GENCities.ValueId3` | → | `GENListValues.Id` |
| `GENCities.ValueId4` | → | `GENListValues.Id` |
| `GENCities.ValueId5` | → | `GENListValues.Id` |
| `GENIndustries.ValueId1` | → | `GENListValues.Id` |
| `GENIndustries.ValueId2` | → | `GENListValues.Id` |
| `GENIndustries.ValueId3` | → | `GENListValues.Id` |
| `GENIndustries.ValueId4` | → | `GENListValues.Id` |
| `GENIndustries.ValueId5` | → | `GENListValues.Id` |
| `GENSalutations.ValueId1` | → | `GENListValues.Id` |
| `GENSalutations.ValueId2` | → | `GENListValues.Id` |
| `GENSalutations.ValueId3` | → | `GENListValues.Id` |
| `GENSalutations.ValueId4` | → | `GENListValues.Id` |
| `GENSalutations.ValueId5` | → | `GENListValues.Id` |
| `CRMSources.ValueId1` | → | `GENListValues.Id` |
| `CRMSources.ValueId2` | → | `GENListValues.Id` |
| `CRMSources.ValueId3` | → | `GENListValues.Id` |
| `CRMSources.ValueId4` | → | `GENListValues.Id` |
| `CRMSources.ValueId5` | → | `GENListValues.Id` |
| `GENTypeStatus.ValueId1` | → | `GENListValues.Id` |
| `GENTypeStatus.ValueId2` | → | `GENListValues.Id` |
| `GENTypeStatus.ValueId3` | → | `GENListValues.Id` |
| `GENTypeStatus.ValueId4` | → | `GENListValues.Id` |
| `GENTypeStatus.ValueId5` | → | `GENListValues.Id` |
| `GENCompanyTypes.ValueId1` | → | `GENListValues.Id` |
| `GENCompanyTypes.ValueId2` | → | `GENListValues.Id` |
| `GENCompanyTypes.ValueId3` | → | `GENListValues.Id` |
| `GENCompanyTypes.ValueId4` | → | `GENListValues.Id` |
| `GENCompanyTypes.ValueId5` | → | `GENListValues.Id` |
| `GENBrands.ValueId1` | → | `GENListValues.Id` |
| `GENBrands.ValueId2` | → | `GENListValues.Id` |
| `GENBrands.ValueId3` | → | `GENListValues.Id` |
| `GENBrands.ValueId4` | → | `GENListValues.Id` |
| `GENBrands.ValueId5` | → | `GENListValues.Id` |
| `GENDistricts.ValueId1` | → | `GENListValues.Id` |
| `GENDistricts.ValueId2` | → | `GENListValues.Id` |
| `GENDistricts.ValueId3` | → | `GENListValues.Id` |
| `GENDistricts.ValueId4` | → | `GENListValues.Id` |
| `GENDistricts.ValueId5` | → | `GENListValues.Id` |
| `GENFeedBackCategories.ValueId1` | → | `GENListValues.Id` |
| `GENFeedBackCategories.ValueId2` | → | `GENListValues.Id` |
| `GENFeedBackCategories.ValueId3` | → | `GENListValues.Id` |
| `GENFeedBackCategories.ValueId4` | → | `GENListValues.Id` |
| `GENFeedBackCategories.ValueId5` | → | `GENListValues.Id` |
| `GENGovernorates.ValueId1` | → | `GENListValues.Id` |
| `GENGovernorates.ValueId2` | → | `GENListValues.Id` |
| `GENGovernorates.ValueId3` | → | `GENListValues.Id` |
| `GENGovernorates.ValueId4` | → | `GENListValues.Id` |
| `GENGovernorates.ValueId5` | → | `GENListValues.Id` |
| `GENStatus.ValueId1` | → | `GENListValues.Id` |
| `GENStatus.ValueId2` | → | `GENListValues.Id` |
| `GENStatus.ValueId3` | → | `GENListValues.Id` |
| `GENStatus.ValueId4` | → | `GENListValues.Id` |
| `GENStatus.ValueId5` | → | `GENListValues.Id` |
| `GENRegions.ValueId1` | → | `GENListValues.Id` |
| `GENRegions.ValueId2` | → | `GENListValues.Id` |
| `GENRegions.ValueId3` | → | `GENListValues.Id` |
| `GENRegions.ValueId4` | → | `GENListValues.Id` |
| `GENRegions.ValueId5` | → | `GENListValues.Id` |
| `GENCommentTypes.ValueId1` | → | `GENListValues.Id` |
| `GENCommentTypes.ValueId2` | → | `GENListValues.Id` |
| `GENCommentTypes.ValueId3` | → | `GENListValues.Id` |
| `GENCommentTypes.ValueId4` | → | `GENListValues.Id` |
| `GENCommentTypes.ValueId5` | → | `GENListValues.Id` |
| `GENPaymentMethods.ValueId1` | → | `GENListValues.Id` |
| `GENPaymentMethods.ValueId2` | → | `GENListValues.Id` |
| `GENPaymentMethods.ValueId3` | → | `GENListValues.Id` |
| `GENPaymentMethods.ValueId4` | → | `GENListValues.Id` |
| `GENPaymentMethods.ValueId5` | → | `GENListValues.Id` |
| `GENVideos.LanguageId` | → | `GENListValues.Id` |
| `GENDepartments.ValueId1` | → | `GENListValues.Id` |
| `GENDepartments.ValueId2` | → | `GENListValues.Id` |
| `GENDepartments.ValueId3` | → | `GENListValues.Id` |
| `GENDepartments.ValueId4` | → | `GENListValues.Id` |
| `GENDepartments.ValueId5` | → | `GENListValues.Id` |
| `GENHomeSliders.ValueId1` | → | `GENListValues.Id` |
| `GENHomeSliders.ValueId2` | → | `GENListValues.Id` |
| `GENHomeSliders.ValueId3` | → | `GENListValues.Id` |
| `GENHomeSliders.ValueId4` | → | `GENListValues.Id` |
| `GENHomeSliders.ValueId5` | → | `GENListValues.Id` |
| `GENPhoneTypes.ValueId1` | → | `GENListValues.Id` |
| `GENPhoneTypes.ValueId2` | → | `GENListValues.Id` |
| `GENPhoneTypes.ValueId3` | → | `GENListValues.Id` |
| `GENPhoneTypes.ValueId4` | → | `GENListValues.Id` |
| `GENPhoneTypes.ValueId5` | → | `GENListValues.Id` |
| `GENConfigurationCategories.ValueId1` | → | `GENListValues.Id` |
| `GENConfigurationCategories.ValueId2` | → | `GENListValues.Id` |
| `GENConfigurationCategories.ValueId3` | → | `GENListValues.Id` |
| `GENConfigurationCategories.ValueId4` | → | `GENListValues.Id` |
| `GENConfigurationCategories.ValueId5` | → | `GENListValues.Id` |
| `GENNews.ValueId1` | → | `GENListValues.Id` |
| `GENNews.ValueId2` | → | `GENListValues.Id` |
| `GENNews.ValueId3` | → | `GENListValues.Id` |
| `GENNews.ValueId4` | → | `GENListValues.Id` |
| `GENNews.ValueId5` | → | `GENListValues.Id` |
| `CRMSRVTicketTypes.ValueId1` | → | `GENListValues.Id` |
| `CRMSRVTicketTypes.ValueId2` | → | `GENListValues.Id` |
| `CRMSRVTicketTypes.ValueId3` | → | `GENListValues.Id` |
| `CRMSRVTicketTypes.ValueId4` | → | `GENListValues.Id` |
| `CRMSRVTicketTypes.ValueId5` | → | `GENListValues.Id` |
| `GENContactTypes.ValueId1` | → | `GENListValues.Id` |
| `GENContactTypes.ValueId2` | → | `GENListValues.Id` |
| `GENContactTypes.ValueId3` | → | `GENListValues.Id` |
| `GENContactTypes.ValueId4` | → | `GENListValues.Id` |
| `GENContactTypes.ValueId5` | → | `GENListValues.Id` |
| `Translate_PageOfPageCustomFieldTabs.LangId` | → | `GENListValues.Id` |
| `GENClassroomCategories.ValueId1` | → | `GENListValues.Id` |
| `GENClassroomCategories.ValueId2` | → | `GENListValues.Id` |
| `GENClassroomCategories.ValueId3` | → | `GENListValues.Id` |
| `GENClassroomCategories.ValueId4` | → | `GENListValues.Id` |
| `GENClassroomCategories.ValueId5` | → | `GENListValues.Id` |
| `GENContactCategories.ValueId1` | → | `GENListValues.Id` |
| `GENContactCategories.ValueId2` | → | `GENListValues.Id` |
| `GENContactCategories.ValueId3` | → | `GENListValues.Id` |
| `GENContactCategories.ValueId4` | → | `GENListValues.Id` |
| `GENContactCategories.ValueId5` | → | `GENListValues.Id` |
| `GENItemCategories.ValueId1` | → | `GENListValues.Id` |
| `GENItemCategories.ValueId2` | → | `GENListValues.Id` |
| `GENItemCategories.ValueId3` | → | `GENListValues.Id` |
| `GENItemCategories.ValueId4` | → | `GENListValues.Id` |
| `GENItemCategories.ValueId5` | → | `GENListValues.Id` |
| `GENQuestionGroups.LanguageId` | → | `GENListValues.Id` |
| `GENQuestionGroups.ValueId1` | → | `GENListValues.Id` |
| `GENQuestionGroups.ValueId2` | → | `GENListValues.Id` |
| `GENQuestionGroups.ValueId3` | → | `GENListValues.Id` |
| `GENQuestionGroups.ValueId4` | → | `GENListValues.Id` |
| `GENQuestionGroups.ValueId5` | → | `GENListValues.Id` |
| `GENTranslate_Role.LangId` | → | `GENListValues.Id` |
| `CRMDealTypes.ValueId1` | → | `GENListValues.Id` |
| `CRMDealTypes.ValueId2` | → | `GENListValues.Id` |
| `CRMDealTypes.ValueId3` | → | `GENListValues.Id` |
| `CRMDealTypes.ValueId4` | → | `GENListValues.Id` |
| `CRMDealTypes.ValueId5` | → | `GENListValues.Id` |
| `GENBranchTypes.ValueId1` | → | `GENListValues.Id` |
| `GENBranchTypes.ValueId2` | → | `GENListValues.Id` |
| `GENBranchTypes.ValueId3` | → | `GENListValues.Id` |
| `GENBranchTypes.ValueId4` | → | `GENListValues.Id` |
| `GENBranchTypes.ValueId5` | → | `GENListValues.Id` |
| `GENBranches.ValueId1` | → | `GENListValues.Id` |
| `GENBranches.ValueId2` | → | `GENListValues.Id` |
| `GENBranches.ValueId3` | → | `GENListValues.Id` |
| `GENBranches.ValueId4` | → | `GENListValues.Id` |
| `GENBranches.ValueId5` | → | `GENListValues.Id` |
| `GENCertificationFrames.LangId` | → | `GENListValues.Id` |
| `GENClassifications.ValueId1` | → | `GENListValues.Id` |
| `GENClassifications.ValueId2` | → | `GENListValues.Id` |
| `GENClassifications.ValueId3` | → | `GENListValues.Id` |
| `GENClassifications.ValueId4` | → | `GENListValues.Id` |
| `GENClassifications.ValueId5` | → | `GENListValues.Id` |
| `GENCurrencies.ValueId1` | → | `GENListValues.Id` |
| `GENCurrencies.ValueId2` | → | `GENListValues.Id` |
| `GENCurrencies.ValueId3` | → | `GENListValues.Id` |
| `GENCurrencies.ValueId4` | → | `GENListValues.Id` |
| `GENCurrencies.ValueId5` | → | `GENListValues.Id` |
| `GENEmployeeCategories.ValueId1` | → | `GENListValues.Id` |
| `GENEmployeeCategories.ValueId2` | → | `GENListValues.Id` |
| `GENEmployeeCategories.ValueId3` | → | `GENListValues.Id` |
| `GENEmployeeCategories.ValueId4` | → | `GENListValues.Id` |
| `GENEmployeeCategories.ValueId5` | → | `GENListValues.Id` |
| `GENEmployeeTypes.ValueId1` | → | `GENListValues.Id` |
| `GENEmployeeTypes.ValueId2` | → | `GENListValues.Id` |
| `GENEmployeeTypes.ValueId3` | → | `GENListValues.Id` |
| `GENEmployeeTypes.ValueId4` | → | `GENListValues.Id` |
| `GENEmployeeTypes.ValueId5` | → | `GENListValues.Id` |
| `GENNewsCategories.ValueId1` | → | `GENListValues.Id` |
| `GENNewsCategories.ValueId2` | → | `GENListValues.Id` |
| `GENNewsCategories.ValueId3` | → | `GENListValues.Id` |
| `GENNewsCategories.ValueId4` | → | `GENListValues.Id` |
| `GENNewsCategories.ValueId5` | → | `GENListValues.Id` |
| `GENProvinces.ValueId1` | → | `GENListValues.Id` |
| `GENProvinces.ValueId2` | → | `GENListValues.Id` |
| `GENProvinces.ValueId3` | → | `GENListValues.Id` |
| `GENProvinces.ValueId4` | → | `GENListValues.Id` |
| `GENProvinces.ValueId5` | → | `GENListValues.Id` |
| `GENRawDataTypes.ValueId1` | → | `GENListValues.Id` |
| `GENRawDataTypes.ValueId2` | → | `GENListValues.Id` |
| `GENRawDataTypes.ValueId3` | → | `GENListValues.Id` |
| `GENRawDataTypes.ValueId4` | → | `GENListValues.Id` |
| `GENRawDataTypes.ValueId5` | → | `GENListValues.Id` |
| `GENSections.ValueId1` | → | `GENListValues.Id` |
| `GENSections.ValueId2` | → | `GENListValues.Id` |
| `GENSections.ValueId3` | → | `GENListValues.Id` |
| `GENSections.ValueId4` | → | `GENListValues.Id` |
| `GENSections.ValueId5` | → | `GENListValues.Id` |
| `GENTranslate_HomeSlider.LangId` | → | `GENListValues.Id` |
| `CRMSourceTypes.ValueId1` | → | `GENListValues.Id` |
| `CRMSourceTypes.ValueId2` | → | `GENListValues.Id` |
| `CRMSourceTypes.ValueId3` | → | `GENListValues.Id` |
| `CRMSourceTypes.ValueId4` | → | `GENListValues.Id` |
| `CRMSourceTypes.ValueId5` | → | `GENListValues.Id` |
| `GENEmailTypes.ValueId1` | → | `GENListValues.Id` |
| `GENEmailTypes.ValueId2` | → | `GENListValues.Id` |
| `GENEmailTypes.ValueId3` | → | `GENListValues.Id` |
| `GENEmailTypes.ValueId4` | → | `GENListValues.Id` |
| `GENEmailTypes.ValueId5` | → | `GENListValues.Id` |
| `GENTags.ValueId1` | → | `GENListValues.Id` |
| `GENTags.ValueId2` | → | `GENListValues.Id` |
| `GENTags.ValueId3` | → | `GENListValues.Id` |
| `GENTags.ValueId4` | → | `GENListValues.Id` |
| `GENTags.ValueId5` | → | `GENListValues.Id` |
| `GENTranslate_News.LangId` | → | `GENListValues.Id` |
| `GENUnits.ValueId1` | → | `GENListValues.Id` |
| `GENUnits.ValueId2` | → | `GENListValues.Id` |
| `GENUnits.ValueId3` | → | `GENListValues.Id` |
| `GENUnits.ValueId4` | → | `GENListValues.Id` |
| `GENUnits.ValueId5` | → | `GENListValues.Id` |
| `CRMDeals.AssessmentId` (EMPTY) | → | `GENListValues.Id` |
| `CRMDeals.PriortyId` (EMPTY) | → | `GENListValues.Id` |
| `CRMDeals.RentPeriodId` (EMPTY) | → | `GENListValues.Id` |
| `CRMDeals.ValueId1` (EMPTY) | → | `GENListValues.Id` |
| `CRMDeals.ValueId2` (EMPTY) | → | `GENListValues.Id` |
| `CRMDeals.ValueId3` (EMPTY) | → | `GENListValues.Id` |
| `CRMDeals.ValueId4` (EMPTY) | → | `GENListValues.Id` |
| `CRMDeals.ValueId5` (EMPTY) | → | `GENListValues.Id` |
| `CRMQuoteItems.NoteListValueId` (EMPTY) | → | `GENListValues.Id` |
| `CRMQuoteStatus.ValueId1` (EMPTY) | → | `GENListValues.Id` |
| `CRMQuoteStatus.ValueId2` (EMPTY) | → | `GENListValues.Id` |
| `CRMQuoteStatus.ValueId3` (EMPTY) | → | `GENListValues.Id` |
| `CRMQuoteStatus.ValueId4` (EMPTY) | → | `GENListValues.Id` |
| `CRMQuoteStatus.ValueId5` (EMPTY) | → | `GENListValues.Id` |
| `CRMQuoteTypes.ValueId1` (EMPTY) | → | `GENListValues.Id` |
| `CRMQuoteTypes.ValueId2` (EMPTY) | → | `GENListValues.Id` |
| `CRMQuoteTypes.ValueId3` (EMPTY) | → | `GENListValues.Id` |
| `CRMQuoteTypes.ValueId4` (EMPTY) | → | `GENListValues.Id` |
| `CRMQuoteTypes.ValueId5` (EMPTY) | → | `GENListValues.Id` |
| `CRMQuotes.AssessmentId` (EMPTY) | → | `GENListValues.Id` |
| `CRMQuotes.NoteListValueId` (EMPTY) | → | `GENListValues.Id` |
| `CRMQuotes.PriortyId` (EMPTY) | → | `GENListValues.Id` |
| `CRMQuotes.RentPeriodId` (EMPTY) | → | `GENListValues.Id` |
| `CRMQuotes.ValueId1` (EMPTY) | → | `GENListValues.Id` |
| `CRMQuotes.ValueId2` (EMPTY) | → | `GENListValues.Id` |
| `CRMQuotes.ValueId3` (EMPTY) | → | `GENListValues.Id` |
| `CRMQuotes.ValueId4` (EMPTY) | → | `GENListValues.Id` |
| `CRMQuotes.ValueId5` (EMPTY) | → | `GENListValues.Id` |
| `CRMSRVIssueTypes.ValueId1` (EMPTY) | → | `GENListValues.Id` |
| `CRMSRVIssueTypes.ValueId2` (EMPTY) | → | `GENListValues.Id` |
| `CRMSRVIssueTypes.ValueId3` (EMPTY) | → | `GENListValues.Id` |
| `CRMSRVIssueTypes.ValueId4` (EMPTY) | → | `GENListValues.Id` |
| `CRMSRVIssueTypes.ValueId5` (EMPTY) | → | `GENListValues.Id` |
| `CRMSRVIssues.ValueId1` (EMPTY) | → | `GENListValues.Id` |
| `CRMSRVIssues.ValueId2` (EMPTY) | → | `GENListValues.Id` |
| `CRMSRVIssues.ValueId3` (EMPTY) | → | `GENListValues.Id` |
| `CRMSRVIssues.ValueId4` (EMPTY) | → | `GENListValues.Id` |
| `CRMSRVIssues.ValueId5` (EMPTY) | → | `GENListValues.Id` |
| `CRMSRVMaintenanceRoleCategories.ValueId1` (EMPTY) | → | `GENListValues.Id` |
| `CRMSRVMaintenanceRoleCategories.ValueId2` (EMPTY) | → | `GENListValues.Id` |
| `CRMSRVMaintenanceRoleCategories.ValueId3` (EMPTY) | → | `GENListValues.Id` |
| `CRMSRVMaintenanceRoleCategories.ValueId4` (EMPTY) | → | `GENListValues.Id` |
| `CRMSRVMaintenanceRoleCategories.ValueId5` (EMPTY) | → | `GENListValues.Id` |
| `CRMSRVMaintenanceRoles.ValueId1` (EMPTY) | → | `GENListValues.Id` |
| `CRMSRVMaintenanceRoles.ValueId2` (EMPTY) | → | `GENListValues.Id` |
| `CRMSRVMaintenanceRoles.ValueId3` (EMPTY) | → | `GENListValues.Id` |
| `CRMSRVMaintenanceRoles.ValueId4` (EMPTY) | → | `GENListValues.Id` |
| `CRMSRVMaintenanceRoles.ValueId5` (EMPTY) | → | `GENListValues.Id` |
| `CRMSRVReasonTypes.ValueId1` (EMPTY) | → | `GENListValues.Id` |
| `CRMSRVReasonTypes.ValueId2` (EMPTY) | → | `GENListValues.Id` |
| `CRMSRVReasonTypes.ValueId3` (EMPTY) | → | `GENListValues.Id` |
| `CRMSRVReasonTypes.ValueId4` (EMPTY) | → | `GENListValues.Id` |
| `CRMSRVReasonTypes.ValueId5` (EMPTY) | → | `GENListValues.Id` |
| `CRMSRVReasons.ClassificationId` (EMPTY) | → | `GENListValues.Id` |
| `CRMSRVReasons.ValueId1` (EMPTY) | → | `GENListValues.Id` |
| `CRMSRVReasons.ValueId2` (EMPTY) | → | `GENListValues.Id` |
| `CRMSRVReasons.ValueId3` (EMPTY) | → | `GENListValues.Id` |
| `CRMSRVReasons.ValueId4` (EMPTY) | → | `GENListValues.Id` |
| `CRMSRVReasons.ValueId5` (EMPTY) | → | `GENListValues.Id` |
| `CRMSRVRequesterTypes.ValueId1` (EMPTY) | → | `GENListValues.Id` |
| `CRMSRVRequesterTypes.ValueId2` (EMPTY) | → | `GENListValues.Id` |
| `CRMSRVRequesterTypes.ValueId3` (EMPTY) | → | `GENListValues.Id` |
| `CRMSRVRequesterTypes.ValueId4` (EMPTY) | → | `GENListValues.Id` |
| `CRMSRVRequesterTypes.ValueId5` (EMPTY) | → | `GENListValues.Id` |
| `CRMSRVRequesters.ValueId1` (EMPTY) | → | `GENListValues.Id` |
| `CRMSRVRequesters.ValueId2` (EMPTY) | → | `GENListValues.Id` |
| `CRMSRVRequesters.ValueId3` (EMPTY) | → | `GENListValues.Id` |
| `CRMSRVRequesters.ValueId4` (EMPTY) | → | `GENListValues.Id` |
| `CRMSRVRequesters.ValueId5` (EMPTY) | → | `GENListValues.Id` |
| `CRMSRVReservations.ValueId1` (EMPTY) | → | `GENListValues.Id` |
| `CRMSRVReservations.ValueId2` (EMPTY) | → | `GENListValues.Id` |
| `CRMSRVReservations.ValueId3` (EMPTY) | → | `GENListValues.Id` |
| `CRMSRVReservations.ValueId4` (EMPTY) | → | `GENListValues.Id` |
| `CRMSRVReservations.ValueId5` (EMPTY) | → | `GENListValues.Id` |
| `CRMSRVTicket_Comment.ListValueId` (EMPTY) | → | `GENListValues.Id` |
| `CRMSRVTicket_Comment.RepeatPeriodId` (EMPTY) | → | `GENListValues.Id` |
| `CRMSRVTicket_Comment.ValueId1` (EMPTY) | → | `GENListValues.Id` |
| `CRMSRVTicket_Comment.ValueId2` (EMPTY) | → | `GENListValues.Id` |
| `CRMSRVTicket_Comment.ValueId3` (EMPTY) | → | `GENListValues.Id` |
| `CRMSRVTicket_Comment.ValueId4` (EMPTY) | → | `GENListValues.Id` |
| `CRMSRVTicket_Comment.ValueId5` (EMPTY) | → | `GENListValues.Id` |
| `CRMSRVTickets.ValueId1` (EMPTY) | → | `GENListValues.Id` |
| `CRMSRVTickets.ValueId2` (EMPTY) | → | `GENListValues.Id` |
| `CRMSRVTickets.ValueId3` (EMPTY) | → | `GENListValues.Id` |
| `CRMSRVTickets.ValueId4` (EMPTY) | → | `GENListValues.Id` |
| `CRMSRVTickets.ValueId5` (EMPTY) | → | `GENListValues.Id` |
| `CRMTickets.AssessmentId` (EMPTY) | → | `GENListValues.Id` |
| `CRMTickets.ClassificationId` (EMPTY) | → | `GENListValues.Id` |
| `CRMTickets.PriortyId` (EMPTY) | → | `GENListValues.Id` |
| `CRMTickets.RentPeriodId` (EMPTY) | → | `GENListValues.Id` |
| `CRMTickets.SatisfactionId` (EMPTY) | → | `GENListValues.Id` |
| `CRMTickets.ValueId1` (EMPTY) | → | `GENListValues.Id` |
| `CRMTickets.ValueId2` (EMPTY) | → | `GENListValues.Id` |
| `CRMTickets.ValueId3` (EMPTY) | → | `GENListValues.Id` |
| `CRMTickets.ValueId4` (EMPTY) | → | `GENListValues.Id` |
| `CRMTickets.ValueId5` (EMPTY) | → | `GENListValues.Id` |
| `CSHTransactions.ListValueId` (EMPTY) | → | `GENListValues.Id` |
| `GENAddressZones.ValueId1` (EMPTY) | → | `GENListValues.Id` |
| `GENAddressZones.ValueId2` (EMPTY) | → | `GENListValues.Id` |
| `GENAddressZones.ValueId3` (EMPTY) | → | `GENListValues.Id` |
| `GENAddressZones.ValueId4` (EMPTY) | → | `GENListValues.Id` |
| `GENAddressZones.ValueId5` (EMPTY) | → | `GENListValues.Id` |
| `GENAreas.ValueId1` (EMPTY) | → | `GENListValues.Id` |
| `GENAreas.ValueId2` (EMPTY) | → | `GENListValues.Id` |
| `GENAreas.ValueId3` (EMPTY) | → | `GENListValues.Id` |
| `GENAreas.ValueId4` (EMPTY) | → | `GENListValues.Id` |
| `GENAreas.ValueId5` (EMPTY) | → | `GENListValues.Id` |
| `GENBackgroundImages.ValueId1` (EMPTY) | → | `GENListValues.Id` |
| `GENBackgroundImages.ValueId2` (EMPTY) | → | `GENListValues.Id` |
| `GENBackgroundImages.ValueId3` (EMPTY) | → | `GENListValues.Id` |
| `GENBackgroundImages.ValueId4` (EMPTY) | → | `GENListValues.Id` |
| `GENBackgroundImages.ValueId5` (EMPTY) | → | `GENListValues.Id` |
| `GENBranchCategories.ValueId1` (EMPTY) | → | `GENListValues.Id` |
| `GENBranchCategories.ValueId2` (EMPTY) | → | `GENListValues.Id` |
| `GENBranchCategories.ValueId3` (EMPTY) | → | `GENListValues.Id` |
| `GENBranchCategories.ValueId4` (EMPTY) | → | `GENListValues.Id` |
| `GENBranchCategories.ValueId5` (EMPTY) | → | `GENListValues.Id` |
| `GENBrandCategories.ValueId1` (EMPTY) | → | `GENListValues.Id` |
| `GENBrandCategories.ValueId2` (EMPTY) | → | `GENListValues.Id` |
| `GENBrandCategories.ValueId3` (EMPTY) | → | `GENListValues.Id` |
| `GENBrandCategories.ValueId4` (EMPTY) | → | `GENListValues.Id` |
| `GENBrandCategories.ValueId5` (EMPTY) | → | `GENListValues.Id` |
| `GENBulkPushNotifications.LangId` (EMPTY) | → | `GENListValues.Id` |
| `GENBulkPushNotifications.ValueId1` (EMPTY) | → | `GENListValues.Id` |
| `GENBulkPushNotifications.ValueId2` (EMPTY) | → | `GENListValues.Id` |
| `GENBulkPushNotifications.ValueId3` (EMPTY) | → | `GENListValues.Id` |
| `GENBulkPushNotifications.ValueId4` (EMPTY) | → | `GENListValues.Id` |
| `GENBulkPushNotifications.ValueId5` (EMPTY) | → | `GENListValues.Id` |
| `GENCityCategories.ValueId1` (EMPTY) | → | `GENListValues.Id` |
| `GENCityCategories.ValueId2` (EMPTY) | → | `GENListValues.Id` |
| `GENCityCategories.ValueId3` (EMPTY) | → | `GENListValues.Id` |
| `GENCityCategories.ValueId4` (EMPTY) | → | `GENListValues.Id` |
| `GENCityCategories.ValueId5` (EMPTY) | → | `GENListValues.Id` |
| `GENClassificationCategories.ValueId1` (EMPTY) | → | `GENListValues.Id` |
| `GENClassificationCategories.ValueId2` (EMPTY) | → | `GENListValues.Id` |
| `GENClassificationCategories.ValueId3` (EMPTY) | → | `GENListValues.Id` |
| `GENClassificationCategories.ValueId4` (EMPTY) | → | `GENListValues.Id` |
| `GENClassificationCategories.ValueId5` (EMPTY) | → | `GENListValues.Id` |
| `GENCompetitionCategories.ValueId1` (EMPTY) | → | `GENListValues.Id` |
| `GENCompetitionCategories.ValueId2` (EMPTY) | → | `GENListValues.Id` |
| `GENCompetitionCategories.ValueId3` (EMPTY) | → | `GENListValues.Id` |
| `GENCompetitionCategories.ValueId4` (EMPTY) | → | `GENListValues.Id` |
| `GENCompetitionCategories.ValueId5` (EMPTY) | → | `GENListValues.Id` |
| `GENCompetitions.ValueId1` (EMPTY) | → | `GENListValues.Id` |
| `GENCompetitions.ValueId2` (EMPTY) | → | `GENListValues.Id` |
| `GENCompetitions.ValueId3` (EMPTY) | → | `GENListValues.Id` |
| `GENCompetitions.ValueId4` (EMPTY) | → | `GENListValues.Id` |
| `GENCompetitions.ValueId5` (EMPTY) | → | `GENListValues.Id` |
| `GENContact_Generic.RelativeRelationId` (EMPTY) | → | `GENListValues.Id` |
| `GENCountryCategories.ValueId1` (EMPTY) | → | `GENListValues.Id` |
| `GENCountryCategories.ValueId2` (EMPTY) | → | `GENListValues.Id` |
| `GENCountryCategories.ValueId3` (EMPTY) | → | `GENListValues.Id` |
| `GENCountryCategories.ValueId4` (EMPTY) | → | `GENListValues.Id` |
| `GENCountryCategories.ValueId5` (EMPTY) | → | `GENListValues.Id` |
| `GENCurrencyCategories.ValueId1` (EMPTY) | → | `GENListValues.Id` |
| `GENCurrencyCategories.ValueId2` (EMPTY) | → | `GENListValues.Id` |
| `GENCurrencyCategories.ValueId3` (EMPTY) | → | `GENListValues.Id` |
| `GENCurrencyCategories.ValueId4` (EMPTY) | → | `GENListValues.Id` |
| `GENCurrencyCategories.ValueId5` (EMPTY) | → | `GENListValues.Id` |
| `GENDashboardWidgets.DisplayId` (EMPTY) | → | `GENListValues.Id` |
| `GENDashboardWidgets.SizeId` (EMPTY) | → | `GENListValues.Id` |
| `GENDashboardWidgets.TypeId` (EMPTY) | → | `GENListValues.Id` |
| `GENDepartmentCategories.ValueId1` (EMPTY) | → | `GENListValues.Id` |
| `GENDepartmentCategories.ValueId2` (EMPTY) | → | `GENListValues.Id` |
| `GENDepartmentCategories.ValueId3` (EMPTY) | → | `GENListValues.Id` |
| `GENDepartmentCategories.ValueId4` (EMPTY) | → | `GENListValues.Id` |
| `GENDepartmentCategories.ValueId5` (EMPTY) | → | `GENListValues.Id` |
| `GENDiscountCategories.ValueId1` (EMPTY) | → | `GENListValues.Id` |
| `GENDiscountCategories.ValueId2` (EMPTY) | → | `GENListValues.Id` |
| `GENDiscountCategories.ValueId3` (EMPTY) | → | `GENListValues.Id` |
| `GENDiscountCategories.ValueId4` (EMPTY) | → | `GENListValues.Id` |
| `GENDiscountCategories.ValueId5` (EMPTY) | → | `GENListValues.Id` |
| `GENDiscounts.ValueId1` (EMPTY) | → | `GENListValues.Id` |
| `GENDiscounts.ValueId2` (EMPTY) | → | `GENListValues.Id` |
| `GENDiscounts.ValueId3` (EMPTY) | → | `GENListValues.Id` |
| `GENDiscounts.ValueId4` (EMPTY) | → | `GENListValues.Id` |
| `GENDiscounts.ValueId5` (EMPTY) | → | `GENListValues.Id` |
| `GENDualLinkAttachments.FileTypeId` (EMPTY) | → | `GENListValues.Id` |
| `GENDualLinkAttachments.LanguageId` (EMPTY) | → | `GENListValues.Id` |
| `GENEmployeeRatings.ValueId1` (EMPTY) | → | `GENListValues.Id` |
| `GENEmployeeRatings.ValueId2` (EMPTY) | → | `GENListValues.Id` |
| `GENEmployeeRatings.ValueId3` (EMPTY) | → | `GENListValues.Id` |
| `GENEmployeeRatings.ValueId4` (EMPTY) | → | `GENListValues.Id` |
| `GENEmployeeRatings.ValueId5` (EMPTY) | → | `GENListValues.Id` |
| `GENEntityClassifications.LanguageId` (EMPTY) | → | `GENListValues.Id` |
| `GENExamAutoGenerators.LanguageId` (EMPTY) | → | `GENListValues.Id` |
| `GENFileAttachments.ValueId1` (EMPTY) | → | `GENListValues.Id` |
| `GENFileAttachments.ValueId2` (EMPTY) | → | `GENListValues.Id` |
| `GENFileAttachments.ValueId3` (EMPTY) | → | `GENListValues.Id` |
| `GENFileAttachments.ValueId4` (EMPTY) | → | `GENListValues.Id` |
| `GENFileAttachments.ValueId5` (EMPTY) | → | `GENListValues.Id` |
| `GENGalleryAlbumCategories.ValueId1` (EMPTY) | → | `GENListValues.Id` |
| `GENGalleryAlbumCategories.ValueId2` (EMPTY) | → | `GENListValues.Id` |
| `GENGalleryAlbumCategories.ValueId3` (EMPTY) | → | `GENListValues.Id` |
| `GENGalleryAlbumCategories.ValueId4` (EMPTY) | → | `GENListValues.Id` |
| `GENGalleryAlbumCategories.ValueId5` (EMPTY) | → | `GENListValues.Id` |
| `GENGalleryAlbumImages.ValueId1` (EMPTY) | → | `GENListValues.Id` |
| `GENGalleryAlbumImages.ValueId2` (EMPTY) | → | `GENListValues.Id` |
| `GENGalleryAlbumImages.ValueId3` (EMPTY) | → | `GENListValues.Id` |
| `GENGalleryAlbumImages.ValueId4` (EMPTY) | → | `GENListValues.Id` |
| `GENGalleryAlbumImages.ValueId5` (EMPTY) | → | `GENListValues.Id` |
| `GENGalleryAlbums.ValueId1` (EMPTY) | → | `GENListValues.Id` |
| `GENGalleryAlbums.ValueId2` (EMPTY) | → | `GENListValues.Id` |
| `GENGalleryAlbums.ValueId3` (EMPTY) | → | `GENListValues.Id` |
| `GENGalleryAlbums.ValueId4` (EMPTY) | → | `GENListValues.Id` |
| `GENGalleryAlbums.ValueId5` (EMPTY) | → | `GENListValues.Id` |
| `GENHomeSliderCategories.ValueId1` (EMPTY) | → | `GENListValues.Id` |
| `GENHomeSliderCategories.ValueId2` (EMPTY) | → | `GENListValues.Id` |
| `GENHomeSliderCategories.ValueId3` (EMPTY) | → | `GENListValues.Id` |
| `GENHomeSliderCategories.ValueId4` (EMPTY) | → | `GENListValues.Id` |
| `GENHomeSliderCategories.ValueId5` (EMPTY) | → | `GENListValues.Id` |
| `GENIndustryCategories.ValueId1` (EMPTY) | → | `GENListValues.Id` |
| `GENIndustryCategories.ValueId2` (EMPTY) | → | `GENListValues.Id` |
| `GENIndustryCategories.ValueId3` (EMPTY) | → | `GENListValues.Id` |
| `GENIndustryCategories.ValueId4` (EMPTY) | → | `GENListValues.Id` |
| `GENIndustryCategories.ValueId5` (EMPTY) | → | `GENListValues.Id` |
| `GENItemCategory_Item.ValueId1` (EMPTY) | → | `GENListValues.Id` |
| `GENItemCategory_Item.ValueId2` (EMPTY) | → | `GENListValues.Id` |
| `GENItemCategory_Item.ValueId3` (EMPTY) | → | `GENListValues.Id` |
| `GENItemCategory_Item.ValueId4` (EMPTY) | → | `GENListValues.Id` |
| `GENItemCategory_Item.ValueId5` (EMPTY) | → | `GENListValues.Id` |
| `GENItemDetails.ValueId1` (EMPTY) | → | `GENListValues.Id` |
| `GENItemDetails.ValueId2` (EMPTY) | → | `GENListValues.Id` |
| `GENItemDetails.ValueId3` (EMPTY) | → | `GENListValues.Id` |
| `GENItemDetails.ValueId4` (EMPTY) | → | `GENListValues.Id` |
| `GENItemDetails.ValueId5` (EMPTY) | → | `GENListValues.Id` |
| `GENItemGroup_Item.ValueId1` (EMPTY) | → | `GENListValues.Id` |
| `GENItemGroup_Item.ValueId2` (EMPTY) | → | `GENListValues.Id` |
| `GENItemGroup_Item.ValueId3` (EMPTY) | → | `GENListValues.Id` |
| `GENItemGroup_Item.ValueId4` (EMPTY) | → | `GENListValues.Id` |
| `GENItemGroup_Item.ValueId5` (EMPTY) | → | `GENListValues.Id` |
| `GENItemGroups.ValueId1` (EMPTY) | → | `GENListValues.Id` |
| `GENItemGroups.ValueId2` (EMPTY) | → | `GENListValues.Id` |
| `GENItemGroups.ValueId3` (EMPTY) | → | `GENListValues.Id` |
| `GENItemGroups.ValueId4` (EMPTY) | → | `GENListValues.Id` |
| `GENItemGroups.ValueId5` (EMPTY) | → | `GENListValues.Id` |
| `GENItemImages.ValueId1` (EMPTY) | → | `GENListValues.Id` |
| `GENItemImages.ValueId2` (EMPTY) | → | `GENListValues.Id` |
| `GENItemImages.ValueId3` (EMPTY) | → | `GENListValues.Id` |
| `GENItemImages.ValueId4` (EMPTY) | → | `GENListValues.Id` |
| `GENItemImages.ValueId5` (EMPTY) | → | `GENListValues.Id` |
| `GENItemPromotions.ValueId1` (EMPTY) | → | `GENListValues.Id` |
| `GENItemPromotions.ValueId2` (EMPTY) | → | `GENListValues.Id` |
| `GENItemPromotions.ValueId3` (EMPTY) | → | `GENListValues.Id` |
| `GENItemPromotions.ValueId4` (EMPTY) | → | `GENListValues.Id` |
| `GENItemPromotions.ValueId5` (EMPTY) | → | `GENListValues.Id` |
| `GENItemToItemPointerTypes.ValueId1` (EMPTY) | → | `GENListValues.Id` |
| `GENItemToItemPointerTypes.ValueId2` (EMPTY) | → | `GENListValues.Id` |
| `GENItemToItemPointerTypes.ValueId3` (EMPTY) | → | `GENListValues.Id` |
| `GENItemToItemPointerTypes.ValueId4` (EMPTY) | → | `GENListValues.Id` |
| `GENItemToItemPointerTypes.ValueId5` (EMPTY) | → | `GENListValues.Id` |
| `GENItemToItemPointers.ValueId1` (EMPTY) | → | `GENListValues.Id` |
| `GENItemToItemPointers.ValueId2` (EMPTY) | → | `GENListValues.Id` |
| `GENItemToItemPointers.ValueId3` (EMPTY) | → | `GENListValues.Id` |
| `GENItemToItemPointers.ValueId4` (EMPTY) | → | `GENListValues.Id` |
| `GENItemToItemPointers.ValueId5` (EMPTY) | → | `GENListValues.Id` |
| `GENItem_Link.ValueId1` (EMPTY) | → | `GENListValues.Id` |
| `GENItem_Link.ValueId2` (EMPTY) | → | `GENListValues.Id` |
| `GENItem_Link.ValueId3` (EMPTY) | → | `GENListValues.Id` |
| `GENItem_Link.ValueId4` (EMPTY) | → | `GENListValues.Id` |
| `GENItem_Link.ValueId5` (EMPTY) | → | `GENListValues.Id` |
| `GENItem_LinkTypes.ValueId1` (EMPTY) | → | `GENListValues.Id` |
| `GENItem_LinkTypes.ValueId2` (EMPTY) | → | `GENListValues.Id` |
| `GENItem_LinkTypes.ValueId3` (EMPTY) | → | `GENListValues.Id` |
| `GENItem_LinkTypes.ValueId4` (EMPTY) | → | `GENListValues.Id` |
| `GENItem_LinkTypes.ValueId5` (EMPTY) | → | `GENListValues.Id` |
| `GENMessagesPushNotifications.LangId` (EMPTY) | → | `GENListValues.Id` |
| `GENMessagesPushNotifications.ValueId1` (EMPTY) | → | `GENListValues.Id` |
| `GENMessagesPushNotifications.ValueId2` (EMPTY) | → | `GENListValues.Id` |
| `GENMessagesPushNotifications.ValueId3` (EMPTY) | → | `GENListValues.Id` |
| `GENMessagesPushNotifications.ValueId4` (EMPTY) | → | `GENListValues.Id` |
| `GENMessagesPushNotifications.ValueId5` (EMPTY) | → | `GENListValues.Id` |
| `GENNewsletters.ValueId1` (EMPTY) | → | `GENListValues.Id` |
| `GENNewsletters.ValueId2` (EMPTY) | → | `GENListValues.Id` |
| `GENNewsletters.ValueId3` (EMPTY) | → | `GENListValues.Id` |
| `GENNewsletters.ValueId4` (EMPTY) | → | `GENListValues.Id` |
| `GENNewsletters.ValueId5` (EMPTY) | → | `GENListValues.Id` |
| `GENOrderCategories.ValueId1` (EMPTY) | → | `GENListValues.Id` |
| `GENOrderCategories.ValueId2` (EMPTY) | → | `GENListValues.Id` |
| `GENOrderCategories.ValueId3` (EMPTY) | → | `GENListValues.Id` |
| `GENOrderCategories.ValueId4` (EMPTY) | → | `GENListValues.Id` |
| `GENOrderCategories.ValueId5` (EMPTY) | → | `GENListValues.Id` |
| `GENPaymentPlans.TimeUnitId` (EMPTY) | → | `GENListValues.Id` |
| `GENPaymentPlans.ValueId1` (EMPTY) | → | `GENListValues.Id` |
| `GENPaymentPlans.ValueId2` (EMPTY) | → | `GENListValues.Id` |
| `GENPaymentPlans.ValueId3` (EMPTY) | → | `GENListValues.Id` |
| `GENPaymentPlans.ValueId4` (EMPTY) | → | `GENListValues.Id` |
| `GENPaymentPlans.ValueId5` (EMPTY) | → | `GENListValues.Id` |
| `GENPerson_Details.BirthplaceId` (EMPTY) | → | `GENListValues.Id` |
| `GENPerson_Details.EmployerId` (EMPTY) | → | `GENListValues.Id` |
| `GENPerson_Details.GenderId` (EMPTY) | → | `GENListValues.Id` |
| `GENPerson_Details.JobId` (EMPTY) | → | `GENListValues.Id` |
| `GENPerson_Details.NationalityId` (EMPTY) | → | `GENListValues.Id` |
| `GENPerson_Details.PositionRecruitmentId` (EMPTY) | → | `GENListValues.Id` |
| `GENPerson_Details.QualificationId` (EMPTY) | → | `GENListValues.Id` |
| `GENPerson_Details.ReligionId` (EMPTY) | → | `GENListValues.Id` |
| `GENPerson_Details.SocialStatusId` (EMPTY) | → | `GENListValues.Id` |
| `GENPerson_Details.TypeofPersonalizationId` (EMPTY) | → | `GENListValues.Id` |
| `GENProcesses.ListValueId` (EMPTY) | → | `GENListValues.Id` |
| `GENProjectCategories.ValueId1` (EMPTY) | → | `GENListValues.Id` |
| `GENProjectCategories.ValueId2` (EMPTY) | → | `GENListValues.Id` |
| `GENProjectCategories.ValueId3` (EMPTY) | → | `GENListValues.Id` |
| `GENProjectCategories.ValueId4` (EMPTY) | → | `GENListValues.Id` |
| `GENProjectCategories.ValueId5` (EMPTY) | → | `GENListValues.Id` |
| `GENProjects.ValueId1` (EMPTY) | → | `GENListValues.Id` |
| `GENProjects.ValueId2` (EMPTY) | → | `GENListValues.Id` |
| `GENProjects.ValueId3` (EMPTY) | → | `GENListValues.Id` |
| `GENProjects.ValueId4` (EMPTY) | → | `GENListValues.Id` |
| `GENProjects.ValueId5` (EMPTY) | → | `GENListValues.Id` |
| `GENRawDatas.AssessmentId` (EMPTY) | → | `GENListValues.Id` |
| `GENRawDatas.GenderId` (EMPTY) | → | `GENListValues.Id` |
| `GENRawDatas.LanguageId` (EMPTY) | → | `GENListValues.Id` |
| `GENRawDatas.PriortyId` (EMPTY) | → | `GENListValues.Id` |
| `GENRawDatas.RentPeriodId` (EMPTY) | → | `GENListValues.Id` |
| `GENRawDatas.ValueId1` (EMPTY) | → | `GENListValues.Id` |
| `GENRawDatas.ValueId2` (EMPTY) | → | `GENListValues.Id` |
| `GENRawDatas.ValueId3` (EMPTY) | → | `GENListValues.Id` |
| `GENRawDatas.ValueId4` (EMPTY) | → | `GENListValues.Id` |
| `GENRawDatas.ValueId5` (EMPTY) | → | `GENListValues.Id` |
| `GENRegionCategories.ValueId1` (EMPTY) | → | `GENListValues.Id` |
| `GENRegionCategories.ValueId2` (EMPTY) | → | `GENListValues.Id` |
| `GENRegionCategories.ValueId3` (EMPTY) | → | `GENListValues.Id` |
| `GENRegionCategories.ValueId4` (EMPTY) | → | `GENListValues.Id` |
| `GENRegionCategories.ValueId5` (EMPTY) | → | `GENListValues.Id` |
| `GENSalutationCategories.ValueId1` (EMPTY) | → | `GENListValues.Id` |
| `GENSalutationCategories.ValueId2` (EMPTY) | → | `GENListValues.Id` |
| `GENSalutationCategories.ValueId3` (EMPTY) | → | `GENListValues.Id` |
| `GENSalutationCategories.ValueId4` (EMPTY) | → | `GENListValues.Id` |
| `GENSalutationCategories.ValueId5` (EMPTY) | → | `GENListValues.Id` |
| `GENSchedulers.ListValueId` (EMPTY) | → | `GENListValues.Id` |
| `GENSchedulers.RepeatPeriodId` (EMPTY) | → | `GENListValues.Id` |
| `GENSchedulers.ValueId1` (EMPTY) | → | `GENListValues.Id` |
| `GENSchedulers.ValueId2` (EMPTY) | → | `GENListValues.Id` |
| `GENSchedulers.ValueId3` (EMPTY) | → | `GENListValues.Id` |
| `GENSchedulers.ValueId4` (EMPTY) | → | `GENListValues.Id` |
| `GENSchedulers.ValueId5` (EMPTY) | → | `GENListValues.Id` |
| `GENSectionCategories.ValueId1` (EMPTY) | → | `GENListValues.Id` |
| `GENSectionCategories.ValueId2` (EMPTY) | → | `GENListValues.Id` |
| `GENSectionCategories.ValueId3` (EMPTY) | → | `GENListValues.Id` |
| `GENSectionCategories.ValueId4` (EMPTY) | → | `GENListValues.Id` |
| `GENSectionCategories.ValueId5` (EMPTY) | → | `GENListValues.Id` |
| `GENServiceCategories.ValueId1` (EMPTY) | → | `GENListValues.Id` |
| `GENServiceCategories.ValueId2` (EMPTY) | → | `GENListValues.Id` |
| `GENServiceCategories.ValueId3` (EMPTY) | → | `GENListValues.Id` |
| `GENServiceCategories.ValueId4` (EMPTY) | → | `GENListValues.Id` |
| `GENServiceCategories.ValueId5` (EMPTY) | → | `GENListValues.Id` |
| `GENServices.ValueId1` (EMPTY) | → | `GENListValues.Id` |
| `GENServices.ValueId2` (EMPTY) | → | `GENListValues.Id` |
| `GENServices.ValueId3` (EMPTY) | → | `GENListValues.Id` |
| `GENServices.ValueId4` (EMPTY) | → | `GENListValues.Id` |
| `GENServices.ValueId5` (EMPTY) | → | `GENListValues.Id` |
| `GENSpecificationGroups.ValueId1` (EMPTY) | → | `GENListValues.Id` |
| `GENSpecificationGroups.ValueId2` (EMPTY) | → | `GENListValues.Id` |
| `GENSpecificationGroups.ValueId3` (EMPTY) | → | `GENListValues.Id` |
| `GENSpecificationGroups.ValueId4` (EMPTY) | → | `GENListValues.Id` |
| `GENSpecificationGroups.ValueId5` (EMPTY) | → | `GENListValues.Id` |
| `GENSpecifications.ValueId1` (EMPTY) | → | `GENListValues.Id` |
| `GENSpecifications.ValueId2` (EMPTY) | → | `GENListValues.Id` |
| `GENSpecifications.ValueId3` (EMPTY) | → | `GENListValues.Id` |
| `GENSpecifications.ValueId4` (EMPTY) | → | `GENListValues.Id` |
| `GENSpecifications.ValueId5` (EMPTY) | → | `GENListValues.Id` |
| `GENStatusMessageCategories.ValueId1` (EMPTY) | → | `GENListValues.Id` |
| `GENStatusMessageCategories.ValueId2` (EMPTY) | → | `GENListValues.Id` |
| `GENStatusMessageCategories.ValueId3` (EMPTY) | → | `GENListValues.Id` |
| `GENStatusMessageCategories.ValueId4` (EMPTY) | → | `GENListValues.Id` |
| `GENStatusMessageCategories.ValueId5` (EMPTY) | → | `GENListValues.Id` |
| `GENStatusMessages.ValueId1` (EMPTY) | → | `GENListValues.Id` |
| `GENStatusMessages.ValueId2` (EMPTY) | → | `GENListValues.Id` |
| `GENStatusMessages.ValueId3` (EMPTY) | → | `GENListValues.Id` |
| `GENStatusMessages.ValueId4` (EMPTY) | → | `GENListValues.Id` |
| `GENStatusMessages.ValueId5` (EMPTY) | → | `GENListValues.Id` |
| `GENTCRs.AssessmentId` (EMPTY) | → | `GENListValues.Id` |
| `GENTCRs.PriortyId` (EMPTY) | → | `GENListValues.Id` |
| `GENTCRs.RentPeriodId` (EMPTY) | → | `GENListValues.Id` |
| `GENTCRs.TCRTypeId` (EMPTY) | → | `GENListValues.Id` |
| `GENTCRs.ValueId1` (EMPTY) | → | `GENListValues.Id` |
| `GENTCRs.ValueId2` (EMPTY) | → | `GENListValues.Id` |
| `GENTCRs.ValueId3` (EMPTY) | → | `GENListValues.Id` |
| `GENTCRs.ValueId4` (EMPTY) | → | `GENListValues.Id` |
| `GENTCRs.ValueId5` (EMPTY) | → | `GENListValues.Id` |
| `GENTranslate_AddressZone.LangId` (EMPTY) | → | `GENListValues.Id` |
| `GENTranslate_Area.LangId` (EMPTY) | → | `GENListValues.Id` |
| `GENTranslate_BackGroundImage.LangId` (EMPTY) | → | `GENListValues.Id` |
| `GENTranslate_BackendPageSectionCategory.LangId` (EMPTY) | → | `GENListValues.Id` |
| `GENTranslate_Branch.LangId` (EMPTY) | → | `GENListValues.Id` |
| `GENTranslate_BranchType.LangId` (EMPTY) | → | `GENListValues.Id` |
| `GENTranslate_Brand.LangId` (EMPTY) | → | `GENListValues.Id` |
| `GENTranslate_BrandCategory.LangId` (EMPTY) | → | `GENListValues.Id` |
| `GENTranslate_BranshCategory.LangId` (EMPTY) | → | `GENListValues.Id` |
| `GENTranslate_BulkPushNotification.LangId` (EMPTY) | → | `GENListValues.Id` |
| `GENTranslate_ClassRoom.LangId` (EMPTY) | → | `GENListValues.Id` |
| `GENTranslate_Classification.LangId` (EMPTY) | → | `GENListValues.Id` |
| `GENTranslate_ClassificationCategory.LangId` (EMPTY) | → | `GENListValues.Id` |
| `GENTranslate_CommentType.LangId` (EMPTY) | → | `GENListValues.Id` |
| `GENTranslate_Company.LangId` (EMPTY) | → | `GENListValues.Id` |
| `GENTranslate_CompanyType.LangId` (EMPTY) | → | `GENListValues.Id` |
| `GENTranslate_Configuration.LangId` (EMPTY) | → | `GENListValues.Id` |
| `GENTranslate_ConfigurationCategory.LangId` (EMPTY) | → | `GENListValues.Id` |
| `GENTranslate_Contact.LangId` (EMPTY) | → | `GENListValues.Id` |
| `GENTranslate_ContactCategory.LangId` (EMPTY) | → | `GENListValues.Id` |
| `GENTranslate_ContactType.LangId` (EMPTY) | → | `GENListValues.Id` |
| `GENTranslate_Currency.LangId` (EMPTY) | → | `GENListValues.Id` |
| `GENTranslate_DealType.LangId` (EMPTY) | → | `GENListValues.Id` |
| `GENTranslate_Department.LangId` (EMPTY) | → | `GENListValues.Id` |
| `GENTranslate_Discount.LangId` (EMPTY) | → | `GENListValues.Id` |
| `GENTranslate_DiscountCategory.LangId` (EMPTY) | → | `GENListValues.Id` |
| `GENTranslate_District.LangId` (EMPTY) | → | `GENListValues.Id` |
| `GENTranslate_EasyAccess.LangId` (EMPTY) | → | `GENListValues.Id` |
| `GENTranslate_EmailType.LangId` (EMPTY) | → | `GENListValues.Id` |
| `GENTranslate_Employee.LangId` (EMPTY) | → | `GENListValues.Id` |
| `GENTranslate_EmployeeCategory.LangId` (EMPTY) | → | `GENListValues.Id` |
| `GENTranslate_EmployeeType.LangId` (EMPTY) | → | `GENListValues.Id` |
| `GENTranslate_FeedBack.LangId` (EMPTY) | → | `GENListValues.Id` |
| `GENTranslate_FeedBackCategory.LangId` (EMPTY) | → | `GENListValues.Id` |
| `GENTranslate_FileAttachment.LangId` (EMPTY) | → | `GENListValues.Id` |
| `GENTranslate_GENTalent.LangId` (EMPTY) | → | `GENListValues.Id` |
| `GENTranslate_GENTalentBuilder.LangId` (EMPTY) | → | `GENListValues.Id` |
| `GENTranslate_GalleryAlbum.LangId` (EMPTY) | → | `GENListValues.Id` |
| `GENTranslate_GalleryAlbumCategory.LangId` (EMPTY) | → | `GENListValues.Id` |
| `GENTranslate_Governorate.LangId` (EMPTY) | → | `GENListValues.Id` |
| `GENTranslate_HomeSliderCategory.LangId` (EMPTY) | → | `GENListValues.Id` |
| `GENTranslate_ImageType.LangId` (EMPTY) | → | `GENListValues.Id` |
| `GENTranslate_Industry.LangId` (EMPTY) | → | `GENListValues.Id` |
| `GENTranslate_IndustryCategory.LangId` (EMPTY) | → | `GENListValues.Id` |
| `GENTranslate_Issue.LangId` (EMPTY) | → | `GENListValues.Id` |
| `GENTranslate_IssueType.LangId` (EMPTY) | → | `GENListValues.Id` |
| `GENTranslate_ItemCategories.LangId` (EMPTY) | → | `GENListValues.Id` |
| `GENTranslate_Item_Specification.LangId` (EMPTY) | → | `GENListValues.Id` |
| `GENTranslate_Items.LangId` (EMPTY) | → | `GENListValues.Id` |
| `GENTranslate_ListValueType.LangId` (EMPTY) | → | `GENListValues.Id` |
| `GENTranslate_MaintenanceRole.LangId` (EMPTY) | → | `GENListValues.Id` |
| `GENTranslate_MaintenanceRoleCategory.LangId` (EMPTY) | → | `GENListValues.Id` |
| `GENTranslate_MessagePushNotifications.LangId` (EMPTY) | → | `GENListValues.Id` |
| `GENTranslate_NewsCategory.LangId` (EMPTY) | → | `GENListValues.Id` |
| `GENTranslate_PaymentMethod.LangId` (EMPTY) | → | `GENListValues.Id` |
| `GENTranslate_PhoneType.LangId` (EMPTY) | → | `GENListValues.Id` |
| `GENTranslate_Poll.LangId` (EMPTY) | → | `GENListValues.Id` |
| `GENTranslate_PollAnswer.LangId` (EMPTY) | → | `GENListValues.Id` |
| `GENTranslate_PollCategory.LangId` (EMPTY) | → | `GENListValues.Id` |
| `GENTranslate_Project.LangId` (EMPTY) | → | `GENListValues.Id` |
| `GENTranslate_Province.LangId` (EMPTY) | → | `GENListValues.Id` |
| `GENTranslate_PushMSGs.LangId` (EMPTY) | → | `GENListValues.Id` |
| `GENTranslate_QuestionGroup.LangId` (EMPTY) | → | `GENListValues.Id` |
| `GENTranslate_QuoteType.LangId` (EMPTY) | → | `GENListValues.Id` |
| `GENTranslate_RawData.LangId` (EMPTY) | → | `GENListValues.Id` |
| `GENTranslate_RawDataCategory.LangId` (EMPTY) | → | `GENListValues.Id` |
| `GENTranslate_RawDataType.LangId` (EMPTY) | → | `GENListValues.Id` |
| `GENTranslate_Reason.LangId` (EMPTY) | → | `GENListValues.Id` |
| `GENTranslate_ReasonType.LangId` (EMPTY) | → | `GENListValues.Id` |
| `GENTranslate_Region.LangId` (EMPTY) | → | `GENListValues.Id` |
| `GENTranslate_Regions.LangId` (EMPTY) | → | `GENListValues.Id` |
| `GENTranslate_Request.LangId` (EMPTY) | → | `GENListValues.Id` |
| `GENTranslate_RequestType.LangId` (EMPTY) | → | `GENListValues.Id` |
| `GENTranslate_Salutation.LangId` (EMPTY) | → | `GENListValues.Id` |
| `GENTranslate_SawaSysMag.LangId` (EMPTY) | → | `GENListValues.Id` |
| `GENTranslate_SectionCategory.LangId` (EMPTY) | → | `GENListValues.Id` |
| `GENTranslate_Sections.LangId` (EMPTY) | → | `GENListValues.Id` |
| `GENTranslate_ServiceCategory.LangId` (EMPTY) | → | `GENListValues.Id` |
| `GENTranslate_Services.LangId` (EMPTY) | → | `GENListValues.Id` |
| `GENTranslate_Source.LangId` (EMPTY) | → | `GENListValues.Id` |
| `GENTranslate_SourceType.LangId` (EMPTY) | → | `GENListValues.Id` |
| `GENTranslate_SpecificationGroup.LangId` (EMPTY) | → | `GENListValues.Id` |
| `GENTranslate_Status.LangId` (EMPTY) | → | `GENListValues.Id` |
| `GENTranslate_StatusMessage.LangId` (EMPTY) | → | `GENListValues.Id` |
| `GENTranslate_StatusMessageCategory.LangId` (EMPTY) | → | `GENListValues.Id` |
| `GENTranslate_Stop.LangId` (EMPTY) | → | `GENListValues.Id` |
| `GENTranslate_TabFeilds.LangId` (EMPTY) | → | `GENListValues.Id` |
| `GENTranslate_Tag.LangId` (EMPTY) | → | `GENListValues.Id` |
| `GENTranslate_TicketType.LangId` (EMPTY) | → | `GENListValues.Id` |
| `GENTranslate_TypeStatus.LangId` (EMPTY) | → | `GENListValues.Id` |
| `GENTranslate_Unit.LangId` (EMPTY) | → | `GENListValues.Id` |
| `GENTranslate_UnitCategory.LangId` (EMPTY) | → | `GENListValues.Id` |
| `GENTranslate_Vehicle.LangId` (EMPTY) | → | `GENListValues.Id` |
| `GENTranslate_VehicleType.LangId` (EMPTY) | → | `GENListValues.Id` |
| `GENTranslate_Vehicles.LangId` (EMPTY) | → | `GENListValues.Id` |
| `GENTranslate_Zone.LangId` (EMPTY) | → | `GENListValues.Id` |
| `GENUnitCategories.ValueId1` (EMPTY) | → | `GENListValues.Id` |
| `GENUnitCategories.ValueId2` (EMPTY) | → | `GENListValues.Id` |
| `GENUnitCategories.ValueId3` (EMPTY) | → | `GENListValues.Id` |
| `GENUnitCategories.ValueId4` (EMPTY) | → | `GENListValues.Id` |
| `GENUnitCategories.ValueId5` (EMPTY) | → | `GENListValues.Id` |
| `GENUserDevices.GenderId` (EMPTY) | → | `GENListValues.Id` |
| `GENVehicleTypes.ValueId1` (EMPTY) | → | `GENListValues.Id` |
| `GENVehicleTypes.ValueId2` (EMPTY) | → | `GENListValues.Id` |
| `GENVehicleTypes.ValueId3` (EMPTY) | → | `GENListValues.Id` |
| `GENVehicleTypes.ValueId4` (EMPTY) | → | `GENListValues.Id` |
| `GENVehicleTypes.ValueId5` (EMPTY) | → | `GENListValues.Id` |
| `GENVehicles.ValueId1` (EMPTY) | → | `GENListValues.Id` |
| `GENVehicles.ValueId2` (EMPTY) | → | `GENListValues.Id` |
| `GENVehicles.ValueId3` (EMPTY) | → | `GENListValues.Id` |
| `GENVehicles.ValueId4` (EMPTY) | → | `GENListValues.Id` |
| `GENVehicles.ValueId5` (EMPTY) | → | `GENListValues.Id` |
| `GENZones.ValueId1` (EMPTY) | → | `GENListValues.Id` |
| `GENZones.ValueId2` (EMPTY) | → | `GENListValues.Id` |
| `GENZones.ValueId3` (EMPTY) | → | `GENListValues.Id` |
| `GENZones.ValueId4` (EMPTY) | → | `GENListValues.Id` |
| `GENZones.ValueId5` (EMPTY) | → | `GENListValues.Id` |
| `ImportLogDatas.AssessmentId` (EMPTY) | → | `GENListValues.Id` |
| `ImportLogDatas.GenderId` (EMPTY) | → | `GENListValues.Id` |
| `ImportLogDatas.LanguageId` (EMPTY) | → | `GENListValues.Id` |
| `ImportLogDatas.PriortyId` (EMPTY) | → | `GENListValues.Id` |
| `ImportLogDatas.RentPeriodId` (EMPTY) | → | `GENListValues.Id` |
| `ImportLogDatas.ValueId1` (EMPTY) | → | `GENListValues.Id` |
| `ImportLogDatas.ValueId2` (EMPTY) | → | `GENListValues.Id` |
| `ImportLogDatas.ValueId3` (EMPTY) | → | `GENListValues.Id` |
| `ImportLogDatas.ValueId4` (EMPTY) | → | `GENListValues.Id` |
| `ImportLogDatas.ValueId5` (EMPTY) | → | `GENListValues.Id` |
| `ItemFlatDatas.ValueId1` (EMPTY) | → | `GENListValues.Id` |
| `ItemFlatDatas.ValueId2` (EMPTY) | → | `GENListValues.Id` |
| `ItemFlatDatas.ValueId3` (EMPTY) | → | `GENListValues.Id` |
| `ItemFlatDatas.ValueId4` (EMPTY) | → | `GENListValues.Id` |
| `ItemFlatDatas.ValueId5` (EMPTY) | → | `GENListValues.Id` |
| `Items_Generic.ItemListValueId` (EMPTY) | → | `GENListValues.Id` |
| `Items_Generic.ListValueId` (EMPTY) | → | `GENListValues.Id` |
| `ListValueTypeCategories.ValueId1` (EMPTY) | → | `GENListValues.Id` |
| `ListValueTypeCategories.ValueId2` (EMPTY) | → | `GENListValues.Id` |
| `ListValueTypeCategories.ValueId3` (EMPTY) | → | `GENListValues.Id` |
| `ListValueTypeCategories.ValueId4` (EMPTY) | → | `GENListValues.Id` |
| `ListValueTypeCategories.ValueId5` (EMPTY) | → | `GENListValues.Id` |
| `RawDataCategories.ValueId1` (EMPTY) | → | `GENListValues.Id` |
| `RawDataCategories.ValueId2` (EMPTY) | → | `GENListValues.Id` |
| `RawDataCategories.ValueId3` (EMPTY) | → | `GENListValues.Id` |
| `RawDataCategories.ValueId4` (EMPTY) | → | `GENListValues.Id` |
| `RawDataCategories.ValueId5` (EMPTY) | → | `GENListValues.Id` |
| `Translate_Specification.LangId` (EMPTY) | → | `GENListValues.Id` |

### `GENStyles` — 1,445 rows

**Referenced by (incoming FKs):**

| From | | To |
|------|--|----|
| `GENPushNotifications.IconId` | → | `GENStyles.Id` |
| `GENContacts.IconId` | → | `GENStyles.Id` |
| `GENExamAnswerHeaders.IconId` | → | `GENStyles.Id` |
| `GENFeedBacks.IconId` | → | `GENStyles.Id` |
| `ContactLogDatas.IconId` | → | `GENStyles.Id` |
| `GENCompanies.IconId` | → | `GENStyles.Id` |
| `GENItems.IconId` | → | `GENStyles.Id` |
| `GENOrders.IconId` | → | `GENStyles.Id` |
| `GENListValues.IconId` | → | `GENStyles.Id` |
| `GENClassrooms.IconId` | → | `GENStyles.Id` |
| `GENTypeCategories.IconId` | → | `GENStyles.Id` |
| `GENPollAnswers.IconId` | → | `GENStyles.Id` |
| `PollCategoryandPolls.IconId` | → | `GENStyles.Id` |
| `GENEmployees.IconId` | → | `GENStyles.Id` |
| `GENPolls.IconId` | → | `GENStyles.Id` |
| `GENWikis.IconId` | → | `GENStyles.Id` |
| `GENTypes.IconId` | → | `GENStyles.Id` |
| `GENPageOfPages.StyleId` | → | `GENStyles.Id` |
| `GENBackendPages.StyleId` | → | `GENStyles.Id` |
| `GENPushNotificationArchives.IconId` | → | `GENStyles.Id` |
| `GENCountries.IconId` | → | `GENStyles.Id` |
| `GENTalents.IconId` | → | `GENStyles.Id` |
| `GENImageTypes.IconId` | → | `GENStyles.Id` |
| `GENWikiCategories.IconId` | → | `GENStyles.Id` |
| `CompanyLogDatas.IconId` | → | `GENStyles.Id` |
| `GENPollCategories.IconId` | → | `GENStyles.Id` |
| `GENBackendPageSections.StyleId` | → | `GENStyles.Id` |
| `Reports.IconId` | → | `GENStyles.Id` |
| `CRMSentEmails.IconId` | → | `GENStyles.Id` |
| `GENRooms.IconId` | → | `GENStyles.Id` |
| `GENTalentBuilders.IconId` | → | `GENStyles.Id` |
| `GENCities.IconId` | → | `GENStyles.Id` |
| `GENIndustries.IconId` | → | `GENStyles.Id` |
| `GENSalutations.IconId` | → | `GENStyles.Id` |
| `GENCompanyTypes.IconId` | → | `GENStyles.Id` |
| `GENBrands.IconId` | → | `GENStyles.Id` |
| `GENDistricts.IconId` | → | `GENStyles.Id` |
| `GENFeedBackCategories.IconId` | → | `GENStyles.Id` |
| `GENGovernorates.IconId` | → | `GENStyles.Id` |
| `GENRegions.IconId` | → | `GENStyles.Id` |
| `GENPaymentMethods.IconId` | → | `GENStyles.Id` |
| `GENDepartments.IconId` | → | `GENStyles.Id` |
| `GENHomeSliders.IconId` | → | `GENStyles.Id` |
| `GENPhoneTypes.IconId` | → | `GENStyles.Id` |
| `GENConfigurationCategories.IconId` | → | `GENStyles.Id` |
| `GENNews.IconId` | → | `GENStyles.Id` |
| `CRMSRVTicketTypes.IconId` | → | `GENStyles.Id` |
| `PageOfPageCustomFieldTabs.StyleId` | → | `GENStyles.Id` |
| `GENClassroomCategories.IconId` | → | `GENStyles.Id` |
| `GENContactCategories.IconId` | → | `GENStyles.Id` |
| `GENItemCategories.IconId` | → | `GENStyles.Id` |
| `GENQuestionGroups.IconId` | → | `GENStyles.Id` |
| `CRMDealTypes.IconId` | → | `GENStyles.Id` |
| `GENBranchTypes.IconId` | → | `GENStyles.Id` |
| `GENBranches.IconId` | → | `GENStyles.Id` |
| `GENClassifications.IconId` | → | `GENStyles.Id` |
| `GENCurrencies.IconId` | → | `GENStyles.Id` |
| `GENEmployeeCategories.IconId` | → | `GENStyles.Id` |
| `GENEmployeeTypes.IconId` | → | `GENStyles.Id` |
| `GENNewsCategories.IconId` | → | `GENStyles.Id` |
| `GENProvinces.IconId` | → | `GENStyles.Id` |
| `GENRawDataTypes.IconId` | → | `GENStyles.Id` |
| `GENSections.IconId` | → | `GENStyles.Id` |
| `GENEmailTypes.IconId` | → | `GENStyles.Id` |
| `GENTags.IconId` | → | `GENStyles.Id` |
| `GENUnits.IconId` | → | `GENStyles.Id` |
| `CRMDeals.IconId` (EMPTY) | → | `GENStyles.Id` |
| `CRMQuoteStatus.IconId` (EMPTY) | → | `GENStyles.Id` |
| `CRMQuoteTypes.IconId` (EMPTY) | → | `GENStyles.Id` |
| `CRMQuotes.IconId` (EMPTY) | → | `GENStyles.Id` |
| `CRMSRVIssueTypes.IconId` (EMPTY) | → | `GENStyles.Id` |
| `CRMSRVIssues.IconId` (EMPTY) | → | `GENStyles.Id` |
| `CRMSRVMaintenanceRoleCategories.IconId` (EMPTY) | → | `GENStyles.Id` |
| `CRMSRVMaintenanceRoles.IconId` (EMPTY) | → | `GENStyles.Id` |
| `CRMSRVReasonTypes.IconId` (EMPTY) | → | `GENStyles.Id` |
| `CRMSRVReasons.IconId` (EMPTY) | → | `GENStyles.Id` |
| `CRMSRVRequesterTypes.IconId` (EMPTY) | → | `GENStyles.Id` |
| `CRMSRVRequesters.IconId` (EMPTY) | → | `GENStyles.Id` |
| `CRMSRVReservations.IconId` (EMPTY) | → | `GENStyles.Id` |
| `CRMSRVTickets.IconId` (EMPTY) | → | `GENStyles.Id` |
| `CRMTickets.IconId` (EMPTY) | → | `GENStyles.Id` |
| `GENAddressZones.IconId` (EMPTY) | → | `GENStyles.Id` |
| `GENAreas.IconId` (EMPTY) | → | `GENStyles.Id` |
| `GENBackgroundImages.IconId` (EMPTY) | → | `GENStyles.Id` |
| `GENBranchCategories.IconId` (EMPTY) | → | `GENStyles.Id` |
| `GENBrandCategories.IconId` (EMPTY) | → | `GENStyles.Id` |
| `GENBulkPushNotifications.IconId` (EMPTY) | → | `GENStyles.Id` |
| `GENBulkRequests.IconId` (EMPTY) | → | `GENStyles.Id` |
| `GENCityCategories.IconId` (EMPTY) | → | `GENStyles.Id` |
| `GENClassificationCategories.IconId` (EMPTY) | → | `GENStyles.Id` |
| `GENCompetitionCategories.IconId` (EMPTY) | → | `GENStyles.Id` |
| `GENCompetitions.IconId` (EMPTY) | → | `GENStyles.Id` |
| `GENCountryCategories.IconId` (EMPTY) | → | `GENStyles.Id` |
| `GENCurrencyCategories.IconId` (EMPTY) | → | `GENStyles.Id` |
| `GENDepartmentCategories.IconId` (EMPTY) | → | `GENStyles.Id` |
| `GENDiscountCategories.IconId` (EMPTY) | → | `GENStyles.Id` |
| `GENDiscounts.IconId` (EMPTY) | → | `GENStyles.Id` |
| `GENEmployeeRatings.IconId` (EMPTY) | → | `GENStyles.Id` |
| `GENFileAttachments.IconId` (EMPTY) | → | `GENStyles.Id` |
| `GENGalleryAlbumCategories.IconId` (EMPTY) | → | `GENStyles.Id` |
| `GENGalleryAlbumImages.IconId` (EMPTY) | → | `GENStyles.Id` |
| `GENGalleryAlbums.IconId` (EMPTY) | → | `GENStyles.Id` |
| `GENHomeSliderCategories.IconId` (EMPTY) | → | `GENStyles.Id` |
| `GENIndustryCategories.IconId` (EMPTY) | → | `GENStyles.Id` |
| `GENItemCategory_Item.IconId` (EMPTY) | → | `GENStyles.Id` |
| `GENItemDetails.IconId` (EMPTY) | → | `GENStyles.Id` |
| `GENItemGroup_Item.IconId` (EMPTY) | → | `GENStyles.Id` |
| `GENItemGroups.IconId` (EMPTY) | → | `GENStyles.Id` |
| `GENItemImages.IconId` (EMPTY) | → | `GENStyles.Id` |
| `GENItemPromotions.IconId` (EMPTY) | → | `GENStyles.Id` |
| `GENItemToItemPointerTypes.IconId` (EMPTY) | → | `GENStyles.Id` |
| `GENItemToItemPointers.IconId` (EMPTY) | → | `GENStyles.Id` |
| `GENItem_Link.IconId` (EMPTY) | → | `GENStyles.Id` |
| `GENItem_LinkTypes.IconId` (EMPTY) | → | `GENStyles.Id` |
| `GENMessagesPushNotifications.IconId` (EMPTY) | → | `GENStyles.Id` |
| `GENNewsletters.IconId` (EMPTY) | → | `GENStyles.Id` |
| `GENOrderCategories.IconId` (EMPTY) | → | `GENStyles.Id` |
| `GENPaymentPlans.IconId` (EMPTY) | → | `GENStyles.Id` |
| `GENProjectCategories.IconId` (EMPTY) | → | `GENStyles.Id` |
| `GENProjects.IconId` (EMPTY) | → | `GENStyles.Id` |
| `GENRawDatas.IconId` (EMPTY) | → | `GENStyles.Id` |
| `GENRegionCategories.IconId` (EMPTY) | → | `GENStyles.Id` |
| `GENRequestTypes.IconId` (EMPTY) | → | `GENStyles.Id` |
| `GENRequests.IconId` (EMPTY) | → | `GENStyles.Id` |
| `GENSalutationCategories.IconId` (EMPTY) | → | `GENStyles.Id` |
| `GENSchedulers.IconId` (EMPTY) | → | `GENStyles.Id` |
| `GENSectionCategories.IconId` (EMPTY) | → | `GENStyles.Id` |
| `GENServiceCategories.IconId` (EMPTY) | → | `GENStyles.Id` |
| `GENServices.IconId` (EMPTY) | → | `GENStyles.Id` |
| `GENSpecificationGroups.IconId` (EMPTY) | → | `GENStyles.Id` |
| `GENSpecifications.IconId` (EMPTY) | → | `GENStyles.Id` |
| `GENStatusMessageCategories.IconId` (EMPTY) | → | `GENStyles.Id` |
| `GENStatusMessages.IconId` (EMPTY) | → | `GENStyles.Id` |
| `GENTCRs.IconId` (EMPTY) | → | `GENStyles.Id` |
| `GENUnitCategories.IconId` (EMPTY) | → | `GENStyles.Id` |
| `GENVehicleTypes.IconId` (EMPTY) | → | `GENStyles.Id` |
| `GENVehicles.IconId` (EMPTY) | → | `GENStyles.Id` |
| `GENZones.IconId` (EMPTY) | → | `GENStyles.Id` |
| `ImportLogDatas.IconId` (EMPTY) | → | `GENStyles.Id` |
| `ItemFlatDatas.IconId` (EMPTY) | → | `GENStyles.Id` |
| `LOGRoutes.IconId` (EMPTY) | → | `GENStyles.Id` |
| `LOGStops.IconId` (EMPTY) | → | `GENStyles.Id` |
| `ListValueTypeCategories.IconId` (EMPTY) | → | `GENStyles.Id` |

### `GENWikis` — 648 rows

**Depends on (outgoing FKs):**

| From | | To |
|------|--|----|
| `GENWikis.DeletedById` | → | `AspNetUsers.Id` |
| `GENWikis.CertFrameId` | → | `GENCertificationFrames.Id` |
| `GENWikis.ContactId` | → | `GENContacts.Id` |
| `GENWikis.ValueId1` | → | `GENListValues.Id` |
| `GENWikis.ValueId2` | → | `GENListValues.Id` |
| `GENWikis.ValueId3` | → | `GENListValues.Id` |
| `GENWikis.ValueId4` | → | `GENListValues.Id` |
| `GENWikis.ValueId5` | → | `GENListValues.Id` |
| `GENWikis.IconId` | → | `GENStyles.Id` |
| `GENWikis.WikiCategoryId` | → | `GENWikiCategories.Id` |

**Referenced by (incoming FKs):**

| From | | To |
|------|--|----|
| `GENCertificates.TemplateId` | → | `GENWikis.Id` |
| `TransmissionHistroys.WikiId` | → | `GENWikis.Id` |
| `GENClassrooms.WikiId` | → | `GENWikis.Id` |
| `GENTranslate_Wiki.WikiId` | → | `GENWikis.Id` |
| `GENEntity_GENWiki.WikiId` | → | `GENWikis.Id` |
| `GENWikiVideos.WikiId` | → | `GENWikis.Id` |
| `GENBackgroundImages.WikiId` (EMPTY) | → | `GENWikis.Id` |
| `GENSection_Wiki.WikiId` (EMPTY) | → | `GENWikis.Id` |
| `GENWikiAudios.WikiId` (EMPTY) | → | `GENWikis.Id` |
| `GENWikiFiles.WikiId` (EMPTY) | → | `GENWikis.Id` |

### `GENClassroomCategories` — 3 rows

**Depends on (outgoing FKs):**

| From | | To |
|------|--|----|
| `GENClassroomCategories.ValueId1` | → | `GENListValues.Id` |
| `GENClassroomCategories.ValueId2` | → | `GENListValues.Id` |
| `GENClassroomCategories.ValueId3` | → | `GENListValues.Id` |
| `GENClassroomCategories.ValueId4` | → | `GENListValues.Id` |
| `GENClassroomCategories.ValueId5` | → | `GENListValues.Id` |
| `GENClassroomCategories.IconId` | → | `GENStyles.Id` |

**Referenced by (incoming FKs):**

| From | | To |
|------|--|----|
| `GENClassrooms.ClassroomCategoryId` | → | `GENClassroomCategories.Id` |

### `GENTalents_Generic` — 921 rows

**Depends on (outgoing FKs):**

| From | | To |
|------|--|----|
| `GENTalents_Generic.VcrId` | → | `GENClassrooms.Id` |
| `GENTalents_Generic.TalentId` | → | `GENTalents.Id` |

### `GENCertification_Requests` — EMPTY

**Depends on (outgoing FKs):**

| From | | To |
|------|--|----|
| `GENCertification_Requests.ClassroomId` | → | `GENClassrooms.Id` |
| `GENCertification_Requests.StudentId` | → | `GENContacts.Id` |
| `GENCertification_Requests.CourseId` | → | `GENTypes.Id` |

**Referenced by (incoming FKs):**

| From | | To |
|------|--|----|
| `GENOrders.CertificationRequestId` | → | `GENCertification_Requests.Id` |

## Empty tables that other tables still FK to

These have **0 rows** in the snapshot but are still part of the relational model (lookups / unused features).

| Empty parent | Referenced by (child tables) |
|--------------|------------------------------|
| `AccessCriterias` | `AuthenticationPageOfPages`, `Authentications` |
| `AspNetUserAddresses` | `GENOrders` |
| `CRMDealItems` | `TCRItems`, `TCRWorkItems` |
| `CRMDeals` | `CRMDealItems`, `CRMQuoteItems`, `CRMQuotes`, `GENTCRs`, `TCRItems`, `TCRWorkItems` |
| `CRMQuoteItems` | `TCRItems` |
| `CRMQuoteTypes` | `CRMQuotes`, `GENTranslate_QuoteType` |
| `CRMQuotes` | `CRMQuoteComments`, `CRMQuoteItems`, `GENTCRs` |
| `CRMSRVIssueTypes` | `CRMSRVIssueTypes`, `CRMSRVIssues`, `GENTranslate_IssueType` |
| `CRMSRVIssues` | `CRMSRVTicket_Issue`, `GENTranslate_Issue` |
| `CRMSRVMaintenanceRoleCategories` | `CRMSRVMaintenanceRoles`, `GENTranslate_MaintenanceRoleCategory` |
| `CRMSRVMaintenanceRoles` | `CRMSRVTicket_MaintenanceWork`, `GENTranslate_MaintenanceRole` |
| `CRMSRVReasonTypes` | `CRMSRVReasons`, `CRMTickets`, `GENTranslate_ReasonType` |
| `CRMSRVReasons` | `CRMDeals`, `CRMQuotes`, `CRMSRVTicketVisits`, `CRMSRVTicket_BranchTransfer`, `CRMSRVTickets`, `CRMTickets`, `GENContacts`, `GENRawDatas` +3 more |
| `CRMSRVRequesterTypes` | `CRMSRVRequesters` |
| `CRMSRVRequesters` | `CRMSRVRequesterAddresses`, `CRMSRVRequesterEmails`, `CRMSRVRequesterPhones`, `CRMSRVRequestersRatigs`, `GENBranches`, `GENBulkRequests`, `GENEmployees`, `GENPushNotificationArchives` +2 more |
| `CRMSRVTicket_Comment` | `ActivityContacts`, `ActivityEmployees`, `GENPushNotifications`, `SchedulerContacts` |
| `CRMSRVTickets` | `CRMSRVTicketVisits`, `CRMSRVTicket_BranchTransfer`, `CRMSRVTicket_Comment`, `CRMSRVTicket_Issue`, `CRMSRVTicket_ItemAttachment`, `CRMSRVTicket_MaintenanceWork`, `CRMSRVTicket_Sparepart`, `CSHTransactions` |
| `CRMTickets` | `CRMSRVTicket_Comment`, `CRMTicket_RelatedTicket`, `CRMTickets`, `GENContacts`, `Items_Generic` |
| `GENAddressZones` | `AspNetUserAddresses`, `GENAddresses`, `GENAreas`, `GENTranslate_AddressZone` |
| `GENAreas` | `AspNetUserAddresses`, `GENAddresses`, `GENTranslate_Area` |
| `GENBackgroundImages` | `GENTranslate_BackGroundImage` |
| `GENBranchCategories` | `GENBranches`, `GENTranslate_BranshCategory` |
| `GENBrandCategories` | `GENBrands`, `GENTranslate_BrandCategory` |
| `GENBulkEmails` | `GENBulkEmailsArchives` |
| `GENBulkPushNotifications` | `GENPushNotifications`, `GENTranslate_BulkPushNotification` |
| `GENBulkRequests` | `GENBulkRequest_LOGStop`, `GENRequests` |
| `GENCertification_Requests` | `GENOrders` |
| `GENCityCategories` | `GENCities` |
| `GENClassificationCategories` | `GENClassifications`, `GENTranslate_ClassificationCategory` |
| `GENCompetitionCategories` | `GENCompetitions` |
| `GENCompetitions` | `GENCompetitionUserItems`, `GENItemCompetitions` |
| `GENCountryCategories` | `GENCountries` |
| `GENCurrencyCategories` | `GENCurrencies` |
| `GENDashboardWidgets` | `GENDashboardWidgetProperties` |
| `GENDepartmentCategories` | `GENDepartments` |
| `GENDiscountCategories` | `GENDiscounts`, `GENTranslate_DiscountCategory` |
| `GENDiscounts` | `GENTranslate_Discount` |
| `GENExamAutoGenerators` | `GENExamGeneratorTags`, `GENPollCategories` |
| `GENFileAttachments` | `GENTranslate_FileAttachment` |
| `GENGalleryAlbumCategories` | `GENGalleryAlbums`, `GENTranslate_GalleryAlbumCategory` |
| `GENGalleryAlbums` | `GENGalleryAlbumImages`, `GENTranslate_GalleryAlbum` |
| `GENHomeSliderCategories` | `GENHomeSliders`, `GENTranslate_HomeSliderCategory` |
| `GENIndustryCategories` | `GENIndustries`, `GENTranslate_IndustryCategory` |
| `GENItemCompetitions` | `GENCompetitionUserItems` |
| `GENItemGroups` | `GENItemGroup_Item` |
| `GENItemToItemPointerTypes` | `GENItemToItemPointers` |
| `GENItem_LinkTypes` | `GENItem_Link`, `GENLinks` |
| `GENItem_Specification` | `GENOrderDetailSpecs`, `GENTranslate_Item_Specification` |
| `GENMessagesPushNotifications` | `GENTranslate_MessagePushNotifications` |
| `GENNewsLetterEmails` | `GENBulkEmails` |
| `GENOrderCategories` | `GENOrders` |
| `GENProcesses` | `GENProcessHistories` |
| `GENProjectCategories` | `GENProjects` |
| `GENProjects` | `CRMDealItems`, `CRMQuoteItems`, `GENItems`, `GENTranslate_Project`, `TCRItems` |
| `GENRawDatas` | `GENTranslate_RawData` |
| `GENRegionCategories` | `GENRegions1` |
| `GENRegions1` | `CRMSRVRequesterAddresses`, `GENBranches`, `GENCompanyAddresses`, `GENContactAddresses`, `GENTranslate_Region` |
| `GENRequestTypes` | `GENBulkRequests`, `GENRequestType_LOGStop`, `GENRequests`, `GENTranslate_RequestType` |
| `GENRequests` | `GENRequestLocations`, `GENTranslate_Request`, `GENUserLocations` |
| `GENSalutationCategories` | `GENSalutations` |
| `GENSawaSysMsgs` | `GENTranslate_SawaSysMag` |
| `GENSectionCategories` | `GENSections`, `GENTranslate_SectionCategory` |
| `GENServiceCategories` | `GENServices`, `GENTranslate_ServiceCategory` |
| `GENServices` | `GENTranslate_Services` |
| `GENSpecificationGroups` | `GENSpecifications`, `GENTranslate_SpecificationGroup` |
| `GENSpecifications` | `GENEntitySpecifications`, `GENItem_Specification`, `Translate_Specification` |
| `GENStatusMessageCategories` | `GENStatusMessages`, `GENTranslate_StatusMessageCategory` |
| `GENStatusMessages` | `GENTranslate_StatusMessage` |
| `GENTCRs` | `TCRItems`, `TCRWorkItems`, `TCRWorkOrders` |
| `GENUnitCategories` | `GENTranslate_UnitCategory`, `GENUnits` |
| `GENVehicleTypes` | `GENTranslate_VehicleType`, `GENVehicleTypeImages`, `GENVehicles` |
| `GENVehicles` | `GENBulkRequests`, `GENRequests`, `GENTranslate_Vehicle`, `GENTranslate_Vehicles`, `GENVehicleUsers` |
| `GENZones` | `GENTranslate_Zone` |
| `ItemFlatDatas` | `CRMSRVTicket_Comment`, `CRMTickets`, `Items_Generic`, `TCRWorkItems` |
| `LOGRoutes` | `GENBulkRequests`, `GENRequestType_LOGStop`, `GENRequests`, `LOGRoutePoints`, `LOGRoute_LOGStop` |
| `LOGStops` | `GENBulkRequest_LOGStop`, `GENBulkRequests`, `GENRequestType_LOGStop`, `GENRequests`, `GENTranslate_Stop`, `LOGRoute_LOGStop` |
| `ListOfActions` | `GENStatus` |
| `RawDataCategories` | `GENRawDatas`, `GENTranslate_RawDataCategory`, `ImportLogDatas` |
| `Repositories` | `RepositoryMethods` |
| `TCRItems` | `TCRWorkItems` |
| `TCRWorkOrders` | `TCRWorkItems` |
# All empty tables and their FK links

Total empty tables: 292 of 502

- `AccessCriterias` — ← AuthenticationPageOfPages, Authentications
- `ActivityContacts` — → CRMSRVTicket_Comment
- `ActivityEmployees` — → BaseEntities, CRMSRVTicket_Comment, GENEmployees
- `AspNetUserAddresses` — → AspNetUsers, GENAddressZones, GENAreas, GENCities, GENCountries, GENDistricts, GENGovernorates, GENProvinces, GENRegions | ← GENOrders
- `AspNetUserLogins` — → AspNetUsers
- `AspNetUserPhones` — → AspNetUsers
- `AuthenticationPageOfPages` — → AccessCriterias, AspNetRoles, GENPageOfPages
- `BackEndSection_Entities` — → BaseEntities
- `BaseEntityURLS` — → BaseEntities
- `BedabSettings` — isolated (no FKs)
- `CRMClient_Contact` — → GENContacts
- `CRMDealItems` — → CRMDeals, GENItems, GENProjects, GENUnits | ← TCRItems, TCRWorkItems
- `CRMDeals` — → CRMDealTypes, CRMSRVReasons, CRMSources, GENCompanies, GENContacts, GENCurrencies, GENEmployees, GENListValues, GENPaymentMethods, GENStatus, GENStyles, GENTypes | ← CRMDealItems, CRMQuoteItems, CRMQuotes, GENTCRs, TCRItems, TCRWorkItems
- `CRMQuoteComments` — → CRMQuotes
- `CRMQuoteItems` — → CRMDeals, CRMQuotes, GENItems, GENListValues, GENProjects, GENUnits | ← TCRItems
- `CRMQuoteStatus` — → GENListValues, GENStyles
- `CRMQuoteTypes` — → GENListValues, GENStyles | ← CRMQuotes, GENTranslate_QuoteType
- `CRMQuotes` — → CRMDealTypes, CRMDeals, CRMQuoteTypes, CRMSRVReasons, CRMSources, GENCompanies, GENContacts, GENCurrencies, GENEmployees, GENListValues, GENPaymentMethods, GENStatus, GENStyles, GENTypes | ← CRMQuoteComments, CRMQuoteItems, GENTCRs
- `CRMSRVIssueTypes` — → CRMSRVIssueTypes, GENListValues, GENStyles | ← CRMSRVIssueTypes, CRMSRVIssues, GENTranslate_IssueType
- `CRMSRVIssues` — → AspNetUsers, CRMSRVIssueTypes, GENItemCategories, GENListValues, GENStyles | ← CRMSRVTicket_Issue, GENTranslate_Issue
- `CRMSRVMaintenanceRoleCategories` — → AspNetUsers, GENListValues, GENStyles | ← CRMSRVMaintenanceRoles, GENTranslate_MaintenanceRoleCategory
- `CRMSRVMaintenanceRoles` — → AspNetUsers, CRMSRVMaintenanceRoleCategories, GENListValues, GENStyles | ← CRMSRVTicket_MaintenanceWork, GENTranslate_MaintenanceRole
- `CRMSRVReasonTypes` — → AspNetUsers, GENListValues, GENStyles | ← CRMSRVReasons, CRMTickets, GENTranslate_ReasonType
- `CRMSRVReasons` — → AspNetUsers, CRMSRVReasonTypes, GENListValues, GENStyles | ← CRMDeals, CRMQuotes, CRMSRVTicketVisits, CRMSRVTicket_BranchTransfer, CRMSRVTickets, CRMTickets, GENContacts, GENRawDatas, GENTCRs, GENTranslate_Reason +1
- `CRMSRVRequesterAddresses` — → CRMSRVRequesters, GENCities, GENCountries, GENRegions1
- `CRMSRVRequesterEmails` — → CRMSRVRequesters
- `CRMSRVRequesterPhones` — → CRMSRVRequesters
- `CRMSRVRequesterTypes` — → GENListValues, GENStyles | ← CRMSRVRequesters
- `CRMSRVRequesters` — → CRMSRVRequesterTypes, GENEmployees, GENIndustries, GENListValues, GENStyles | ← CRMSRVRequesterAddresses, CRMSRVRequesterEmails, CRMSRVRequesterPhones, CRMSRVRequestersRatigs, GENBranches, GENBulkRequests, GENEmployees, GENPushNotificationArchives, GENPushNotifications, GENRequests
- `CRMSRVRequestersRatigs` — → CRMSRVRequesters
- `CRMSRVReservations` — → AspNetUsers, GENBranches, GENListValues, GENStatus, GENStyles
- `CRMSRVTicketVisits` — → CRMSRVReasons, CRMSRVTickets, GENEmployees
- `CRMSRVTicket_BranchTransfer` — → AspNetUsers, CRMSRVReasons, CRMSRVTickets, GENBranches, GENEmployees, GENStatus
- `CRMSRVTicket_Comment` — → AspNetUsers, BaseEntities, CRMSRVTickets, CRMTickets, GENCommentTypes, GENContacts, GENItems, GENListValues, GENPageOfPages, GENPaymentMethods, GENStatus, ItemFlatDatas | ← ActivityContacts, ActivityEmployees, GENPushNotifications, SchedulerContacts
- `CRMSRVTicket_Issue` — → AspNetUsers, CRMSRVIssues, CRMSRVTickets
- `CRMSRVTicket_ItemAttachment` — → AspNetUsers, CRMSRVTickets, GENItems
- `CRMSRVTicket_MaintenanceWork` — → AspNetUsers, CRMSRVMaintenanceRoles, CRMSRVTickets, GENEmployees, GENStatus
- `CRMSRVTicket_Sparepart` — → AspNetUsers, CRMSRVTickets, GENItems
- `CRMSRVTickets` — → AspNetUsers, CRMSRVReasons, CRMSRVTicketTypes, GENBranches, GENCompanies, GENContacts, GENItemCategories, GENItems, GENListValues, GENStatus, GENStyles | ← CRMSRVTicketVisits, CRMSRVTicket_BranchTransfer, CRMSRVTicket_Comment, CRMSRVTicket_Issue, CRMSRVTicket_ItemAttachment, CRMSRVTicket_MaintenanceWork, CRMSRVTicket_Sparepart, CSHTransactions
- `CRMTicket_RelatedTicket` — → CRMTickets
- `CRMTickets` — → CRMSRVReasonTypes, CRMSRVReasons, CRMSRVTicketTypes, CRMSources, CRMTickets, GENBranches, GENBrands, GENCompanies, GENContactCategories, GENContacts, GENCurrencies, GENEmployees, GENItems, GENListValues, GENPaymentMethods, GENStatus, GENStyles, ItemFlatDatas | ← CRMSRVTicket_Comment, CRMTicket_RelatedTicket, CRMTickets, GENContacts, Items_Generic
- `CSHTransactions` — → CRMSRVTickets, GENListValues
- `CandidateEmployees` — → AspNetUsers, GENEmployees
- `CompanyContactMerge` — isolated (no FKs)
- `CompanyContactMergeMirror` — isolated (no FKs)
- `CompanySettings` — isolated (no FKs)
- `Course_Question` — → GENPolls, GENTypes
- `DataBaseBackups` — isolated (no FKs)
- `DealInfoes` — isolated (no FKs)
- `DependencyTalentBuilders` — → GENTalentBuilders
- `EACA_NewContacts` — isolated (no FKs)
- `EmogyUserReplies` — → AspNetUsers, BaseEntities, Emogies, GENComments
- `EmployeeEscalations` — → GENEmployees
- `EmployeeInfoes` — isolated (no FKs)
- `GENAddressZones` — → GENDistricts, GENListValues, GENStyles | ← AspNetUserAddresses, GENAddresses, GENAreas, GENTranslate_AddressZone
- `GENAreas` — → GENAddressZones, GENListValues, GENStyles | ← AspNetUserAddresses, GENAddresses, GENTranslate_Area
- `GENAudios` — → BaseEntities
- `GENBackgroundImages` — → GENListValues, GENSections, GENStyles, GENWikis | ← GENTranslate_BackGroundImage
- `GENBranchCategories` — → GENListValues, GENStyles | ← GENBranches, GENTranslate_BranshCategory
- `GENBrandCategories` — → GENListValues, GENStyles | ← GENBrands, GENTranslate_BrandCategory
- `GENBulkEmails` — → GENNewsLetterEmails | ← GENBulkEmailsArchives
- `GENBulkEmailsArchives` — → GENBulkEmails
- `GENBulkPushNotifications` — → BaseEntities, GENListValues, GENStyles | ← GENPushNotifications, GENTranslate_BulkPushNotification
- `GENBulkRequest_LOGStop` — → GENBulkRequests, GENStatus, LOGStops
- `GENBulkRequests` — → AspNetUsers, CRMSRVRequesters, GENCompanies, GENPaymentMethods, GENRequestTypes, GENStatus, GENStyles, GENVehicles, LOGRoutes, LOGStops | ← GENBulkRequest_LOGStop, GENRequests
- `GENCertification_Requests` — → GENClassrooms, GENContacts, GENTypes | ← GENOrders
- `GENCityCategories` — → GENListValues, GENStyles | ← GENCities
- `GENClassificationCategories` — → GENListValues, GENStyles | ← GENClassifications, GENTranslate_ClassificationCategory
- `GENCompaniesRatings` — → GENCompanies
- `GENCompanyAddresses` — → GENCities, GENCompanies, GENCountries, GENRegions1
- `GENCompanyComments` — → GENCompanies
- `GENCompetitionCategories` — → GENListValues, GENStyles | ← GENCompetitions
- `GENCompetitionUserItems` — → AspNetUsers, GENCompetitions, GENItemCompetitions
- `GENCompetitions` — → GENBrands, GENCompetitionCategories, GENItemCategories, GENListValues, GENStyles | ← GENCompetitionUserItems, GENItemCompetitions
- `GENContactAddresses` — → GENCities, GENContacts, GENCountries, GENRegions1
- `GENContactComments` — → GENContacts
- `GENContact_Generic` — → BaseEntities, GENContacts, GENListValues
- `GENContact_News` — → GENContacts, GENNews
- `GENCountryCategories` — → GENListValues, GENStyles | ← GENCountries
- `GENCurrencyCategories` — → GENListValues, GENStyles | ← GENCurrencies
- `GENDashboardWidgetProperties` — → GENDashboardWidgets
- `GENDashboardWidgets` — → BaseEntities, GENListValues | ← GENDashboardWidgetProperties
- `GENDepartmentCategories` — → GENListValues, GENStyles | ← GENDepartments
- `GENDiscountCardImport` — isolated (no FKs)
- `GENDiscountCardImportFields` — isolated (no FKs)
- `GENDiscountCardLogDatas` — isolated (no FKs)
- `GENDiscountCategories` — → GENListValues, GENStyles | ← GENDiscounts, GENTranslate_DiscountCategory
- `GENDiscounts` — → GENDiscountCategories, GENListValues, GENStyles | ← GENTranslate_Discount
- `GENDriverRatings` — → AspNetUsers
- `GENDualLinkAttachments` — → GENListValues
- `GENEmployeeRatings` — → GENEmployees, GENListValues, GENStyles
- `GENEntityClassifications` — → BaseEntities, GENClassifications, GENListValues
- `GENEntitySpecifications` — → BaseEntities, GENSpecifications, GENUnits
- `GENExamAutoGenerators` — → GENListValues | ← GENExamGeneratorTags, GENPollCategories
- `GENExamGeneratorTags` — → GENExamAutoGenerators, GENTags
- `GENExam_GENTalent` — → GENPollCategories, GENTalents
- `GENExam_Generic` — → BaseEntities, GENPollCategories
- `GENFileAttachments` — → BaseEntities, GENBrands, GENClassrooms, GENEmployees, GENItemCategories, GENItems, GENListValues, GENSections, GENStyles, GENTalents, GENTypes | ← GENTranslate_FileAttachment
- `GENGalleryAlbumCategories` — → GENListValues, GENStyles | ← GENGalleryAlbums, GENTranslate_GalleryAlbumCategory
- `GENGalleryAlbumImages` — → GENGalleryAlbums, GENListValues, GENStyles
- `GENGalleryAlbums` — → GENBrands, GENGalleryAlbumCategories, GENItemCategories, GENListValues, GENSections, GENStyles | ← GENGalleryAlbumImages, GENTranslate_GalleryAlbum
- `GENGenericCodes` — → BaseEntities, GENPageOfPages
- `GENHomeSliderCategories` — → GENListValues, GENStyles | ← GENHomeSliders, GENTranslate_HomeSliderCategory
- `GENIndustryCategories` — → GENListValues, GENStyles | ← GENIndustries, GENTranslate_IndustryCategory
- `GENItemAttachments` — → GENItems
- `GENItemAudios` — → GENItems
- `GENItemCategoryImages` — → GENItemCategories
- `GENItemCategory_Item` — → GENItemCategories, GENItems, GENListValues, GENStyles
- `GENItemCompetitions` — → GENCompetitions, GENItems | ← GENCompetitionUserItems
- `GENItemDetails` — → GENItems, GENListValues, GENStyles
- `GENItemGroup_Item` — → GENItemGroups, GENItems, GENListValues, GENStyles
- `GENItemGroups` — → GENListValues, GENStyles | ← GENItemGroup_Item
- `GENItemImages` — → GENItems, GENListValues, GENStyles
- `GENItemPackings` — → GENItems, GENUnits
- `GENItemPromotions` — → GENItems, GENListValues, GENStyles
- `GENItemTags` — → GENItems, GENTags
- `GENItemToItemPointerTypes` — → GENListValues, GENStyles | ← GENItemToItemPointers
- `GENItemToItemPointers` — → GENItemToItemPointerTypes, GENItems, GENListValues, GENStyles
- `GENItem_Bundle` — → GENItems
- `GENItem_Link` — → GENItem_LinkTypes, GENItems, GENListValues, GENStyles
- `GENItem_LinkTypes` — → GENListValues, GENStyles | ← GENItem_Link, GENLinks
- `GENItem_Sessions` — → GENItems
- `GENItem_Specification` — → GENItems, GENSpecifications, GENUnits | ← GENOrderDetailSpecs, GENTranslate_Item_Specification
- `GENMessage_Status` — → BaseEntities, GENStatus
- `GENMessagesPushNotifications` — → GENListValues, GENStyles | ← GENTranslate_MessagePushNotifications
- `GENNewsLetterEmails` — ← GENBulkEmails
- `GENNewsletters` — → GENListValues, GENStyles
- `GENNextStatus` — isolated (no FKs)
- `GENNotificationsRelatedDatas` — → GENPushNotifications
- `GENOrderCategories` — → GENListValues, GENStyles | ← GENOrders
- `GENOrderDetailSpecs` — → GENItem_Specification, GENOrderDetails
- `GENPaymenetEntities` — → BaseEntities, GENPaymentMethods
- `GENPaymentPlans` — → GENListValues, GENStyles
- `GENPaymentTransactions` — → GENOrders, GENPaymentMethods, GENStatus
- `GENPerson_Details` — → BaseEntities, GENCompanies, GENGovernorates, GENListValues, GENSalutations
- `GENProcessHistories` — → BaseEntities, GENEmployees, GENProcesses
- `GENProcesses` — → BaseEntities, GENListValues, GENStatus | ← GENProcessHistories
- `GENProjectCategories` — → GENListValues, GENStyles | ← GENProjects
- `GENProjects` — → CRMSources, GENCompanies, GENContacts, GENDistricts, GENListValues, GENProjectCategories, GENStyles | ← CRMDealItems, CRMQuoteItems, GENItems, GENTranslate_Project, TCRItems
- `GENRawDatas` — → AspNetUsers, BaseEntities, CRMSRVReasons, CRMSources, GENBranches, GENBrands, GENCompanies, GENDepartments, GENListValues, GENPaymentMethods, GENRawDataTypes, GENSalutations, GENStatus, GENStyles, GENTypes, RawDataCategories | ← GENTranslate_RawData
- `GENReacts` — → AspNetUsers, BaseEntities, GENBlogs
- `GENRegionCategories` — → GENListValues, GENStyles | ← GENRegions1
- `GENRegions1` — → GENCities, GENRegionCategories | ← CRMSRVRequesterAddresses, GENBranches, GENCompanyAddresses, GENContactAddresses, GENTranslate_Region
- `GENRequestLocations` — → AspNetUsers, GENRequests, GENStatus
- `GENRequestType_LOGStop` — → GENRequestTypes, LOGRoutes, LOGStops
- `GENRequestTypes` — → GENStyles | ← GENBulkRequests, GENRequestType_LOGStop, GENRequests, GENTranslate_RequestType
- `GENRequests` — → AspNetUsers, CRMSRVRequesters, GENBulkRequests, GENCompanies, GENContacts, GENEmployees, GENPaymentMethods, GENRequestTypes, GENStatus, GENStyles, GENVehicles, LOGRoutes, LOGStops | ← GENRequestLocations, GENTranslate_Request, GENUserLocations
- `GENReviews` — → AspNetUsers, BaseEntities
- `GENSalutationCategories` — → GENListValues, GENStyles | ← GENSalutations
- `GENSawaSysMsgs` — ← GENTranslate_SawaSysMag
- `GENSchedulers` — → BaseEntities, GENCommentTypes, GENListValues, GENStyles
- `GENSectionCategories` — → GENListValues, GENStyles | ← GENSections, GENTranslate_SectionCategory
- `GENSection_Wiki` — → GENSections, GENWikis
- `GENServiceCategories` — → GENListValues, GENStyles | ← GENServices, GENTranslate_ServiceCategory
- `GENServices` — → GENListValues, GENServiceCategories, GENStyles | ← GENTranslate_Services
- `GENSpecificationGroups` — → GENListValues, GENStyles | ← GENSpecifications, GENTranslate_SpecificationGroup
- `GENSpecifications` — → GENListValues, GENSpecificationGroups, GENStyles | ← GENEntitySpecifications, GENItem_Specification, Translate_Specification
- `GENStatusBaseEntities` — → BaseEntities, GENStatus
- `GENStatusMessageCategories` — → GENListValues, GENStyles | ← GENStatusMessages, GENTranslate_StatusMessageCategory
- `GENStatusMessages` — → GENListValues, GENStatusMessageCategories, GENStyles | ← GENTranslate_StatusMessage
- `GENTCRs` — → CRMDealTypes, CRMDeals, CRMQuotes, CRMSRVReasons, CRMSources, GENBranches, GENBrands, GENCompanies, GENContacts, GENCurrencies, GENEmployees, GENListValues, GENPaymentMethods, GENStatus, GENStyles, GENTypes | ← TCRItems, TCRWorkItems, TCRWorkOrders
- `GENTranslate_AddressZone` — → BaseEntityFields, GENAddressZones, GENListValues, PageOfPageFeilds
- `GENTranslate_Area` — → BaseEntityFields, GENAreas, GENListValues, PageOfPageFeilds
- `GENTranslate_BackGroundImage` — → BaseEntityFields, GENBackgroundImages, GENListValues, PageOfPageFeilds
- `GENTranslate_BackendPageSectionCategory` — → BaseEntityFields, GENBackendPageSectionCategories, GENListValues, PageOfPageFeilds
- `GENTranslate_Branch` — → BaseEntityFields, GENBranches, GENListValues, PageOfPageFeilds
- `GENTranslate_BranchType` — → BaseEntityFields, GENBranchTypes, GENListValues, PageOfPageFeilds
- `GENTranslate_Brand` — → BaseEntityFields, GENBrands, GENListValues, PageOfPageFeilds
- `GENTranslate_BrandCategory` — → BaseEntityFields, GENBrandCategories, GENListValues, PageOfPageFeilds
- `GENTranslate_BranshCategory` — → BaseEntityFields, GENBranchCategories, GENListValues, PageOfPageFeilds
- `GENTranslate_BulkPushNotification` — → BaseEntityFields, GENBulkPushNotifications, GENListValues, PageOfPageFeilds
- `GENTranslate_ClassRoom` — → BaseEntityFields, GENClassrooms, GENListValues, PageOfPageFeilds
- `GENTranslate_Classification` — → BaseEntityFields, GENClassifications, GENListValues, PageOfPageFeilds
- `GENTranslate_ClassificationCategory` — → BaseEntityFields, GENClassificationCategories, GENListValues, PageOfPageFeilds
- `GENTranslate_CommentType` — → BaseEntityFields, GENCommentTypes, GENListValues, PageOfPageFeilds
- `GENTranslate_Company` — → BaseEntityFields, GENCompanies, GENListValues, PageOfPageFeilds
- `GENTranslate_CompanyType` — → BaseEntityFields, GENCompanyTypes, GENListValues, PageOfPageFeilds
- `GENTranslate_Configuration` — → BaseEntityFields, GENConfigurations, GENListValues, PageOfPageFeilds
- `GENTranslate_ConfigurationCategory` — → BaseEntityFields, GENConfigurationCategories, GENListValues, PageOfPageFeilds
- `GENTranslate_Contact` — → BaseEntityFields, GENContacts, GENListValues, PageOfPageFeilds
- `GENTranslate_ContactCategory` — → BaseEntityFields, GENContactCategories, GENListValues, PageOfPageFeilds
- `GENTranslate_ContactType` — → BaseEntityFields, GENContactTypes, GENListValues, PageOfPageFeilds
- `GENTranslate_Currency` — → BaseEntityFields, GENCurrencies, GENListValues, GENUnits, PageOfPageFeilds
- `GENTranslate_DealType` — → BaseEntityFields, CRMDealTypes, GENListValues, PageOfPageFeilds
- `GENTranslate_Department` — → BaseEntityFields, GENDepartments, GENListValues, PageOfPageFeilds
- `GENTranslate_Discount` — → BaseEntityFields, GENDiscounts, GENListValues, PageOfPageFeilds
- `GENTranslate_DiscountCategory` — → BaseEntityFields, GENDiscountCategories, GENListValues, PageOfPageFeilds
- `GENTranslate_District` — → BaseEntityFields, GENDistricts, GENListValues, PageOfPageFeilds
- `GENTranslate_EasyAccess` — → BaseEntityFields, GENEasyAccesses, GENListValues, PageOfPageFeilds
- `GENTranslate_EmailType` — → BaseEntityFields, GENEmailTypes, GENListValues, PageOfPageFeilds
- `GENTranslate_Employee` — → BaseEntityFields, GENEmployees, GENListValues, PageOfPageFeilds
- `GENTranslate_EmployeeCategory` — → BaseEntityFields, GENEmployeeCategories, GENListValues, PageOfPageFeilds
- `GENTranslate_EmployeeType` — → BaseEntityFields, GENEmployeeTypes, GENListValues, PageOfPageFeilds
- `GENTranslate_FeedBack` — → BaseEntityFields, GENFeedBacks, GENListValues, PageOfPageFeilds
- `GENTranslate_FeedBackCategory` — → BaseEntityFields, GENFeedBackCategories, GENListValues, PageOfPageFeilds
- `GENTranslate_FileAttachment` — → BaseEntityFields, GENFileAttachments, GENListValues, PageOfPageFeilds
- `GENTranslate_GENTalent` — → BaseEntityFields, GENListValues, GENTalents, PageOfPageFeilds
- `GENTranslate_GENTalentBuilder` — → BaseEntityFields, GENListValues, GENTalentBuilders, PageOfPageFeilds
- `GENTranslate_GalleryAlbum` — → BaseEntityFields, GENGalleryAlbums, GENListValues, PageOfPageFeilds
- `GENTranslate_GalleryAlbumCategory` — → BaseEntityFields, GENGalleryAlbumCategories, GENListValues, PageOfPageFeilds
- `GENTranslate_Governorate` — → BaseEntityFields, GENGovernorates, GENListValues, PageOfPageFeilds
- `GENTranslate_HomeSliderCategory` — → BaseEntityFields, GENHomeSliderCategories, GENListValues, PageOfPageFeilds
- `GENTranslate_ImageType` — → BaseEntityFields, GENImageTypes, GENListValues, PageOfPageFeilds
- `GENTranslate_Industry` — → BaseEntityFields, GENIndustries, GENListValues, PageOfPageFeilds
- `GENTranslate_IndustryCategory` — → BaseEntityFields, GENIndustryCategories, GENListValues, PageOfPageFeilds
- `GENTranslate_Issue` — → BaseEntityFields, CRMSRVIssues, GENListValues, PageOfPageFeilds
- `GENTranslate_IssueType` — → BaseEntityFields, CRMSRVIssueTypes, GENListValues, PageOfPageFeilds
- `GENTranslate_ItemCategories` — → BaseEntityFields, GENItemCategories, GENListValues, PageOfPageFeilds
- `GENTranslate_Item_Specification` — → BaseEntityFields, GENItem_Specification, GENListValues, PageOfPageFeilds
- `GENTranslate_Items` — → BaseEntityFields, GENItems, GENListValues, PageOfPageFeilds
- `GENTranslate_ListValueType` — → BaseEntityFields, GENListValues, GENListValuesTypes, PageOfPageFeilds
- `GENTranslate_MaintenanceRole` — → BaseEntityFields, CRMSRVMaintenanceRoles, GENListValues, PageOfPageFeilds
- `GENTranslate_MaintenanceRoleCategory` — → BaseEntityFields, CRMSRVMaintenanceRoleCategories, GENListValues, PageOfPageFeilds
- `GENTranslate_MessagePushNotifications` — → BaseEntityFields, GENListValues, GENMessagesPushNotifications, PageOfPageFeilds
- `GENTranslate_NewsCategory` — → BaseEntityFields, GENListValues, GENNewsCategories, PageOfPageFeilds
- `GENTranslate_PaymentMethod` — → BaseEntityFields, GENListValues, GENPaymentMethods, PageOfPageFeilds
- `GENTranslate_PhoneType` — → BaseEntityFields, GENListValues, GENPhoneTypes, PageOfPageFeilds
- `GENTranslate_Poll` — → BaseEntityFields, GENListValues, GENPolls, PageOfPageFeilds
- `GENTranslate_PollAnswer` — → BaseEntityFields, GENListValues, GENPollAnswers, PageOfPageFeilds
- `GENTranslate_PollCategory` — → BaseEntityFields, GENListValues, GENPollCategories, PageOfPageFeilds
- `GENTranslate_Project` — → BaseEntityFields, GENListValues, GENProjects, PageOfPageFeilds
- `GENTranslate_Province` — → BaseEntityFields, GENListValues, GENProvinces, PageOfPageFeilds
- `GENTranslate_PushMSGs` — → BaseEntityFields, GENListValues, PageOfPageFeilds, PushMSGs
- `GENTranslate_QuestionGroup` — → BaseEntityFields, GENListValues, GENQuestionGroups, PageOfPageFeilds
- `GENTranslate_QuoteType` — → BaseEntityFields, CRMQuoteTypes, GENListValues, PageOfPageFeilds
- `GENTranslate_RawData` — → BaseEntityFields, GENListValues, GENRawDatas, PageOfPageFeilds
- `GENTranslate_RawDataCategory` — → BaseEntityFields, GENListValues, PageOfPageFeilds, RawDataCategories
- `GENTranslate_RawDataType` — → BaseEntityFields, GENListValues, GENRawDataTypes, PageOfPageFeilds
- `GENTranslate_Reason` — → BaseEntityFields, CRMSRVReasons, GENListValues, PageOfPageFeilds
- `GENTranslate_ReasonType` — → BaseEntityFields, CRMSRVReasonTypes, GENListValues, PageOfPageFeilds
- `GENTranslate_Region` — → BaseEntityFields, GENListValues, GENRegions1, PageOfPageFeilds
- `GENTranslate_Regions` — → BaseEntityFields, GENListValues, GENRegions, PageOfPageFeilds
- `GENTranslate_Request` — → BaseEntityFields, GENListValues, GENRequests, PageOfPageFeilds
- `GENTranslate_RequestType` — → BaseEntityFields, GENListValues, GENRequestTypes, PageOfPageFeilds
- `GENTranslate_Salutation` — → BaseEntityFields, GENListValues, GENSalutations, PageOfPageFeilds
- `GENTranslate_SawaSysMag` — → GENListValues, GENSawaSysMsgs, PageOfPageFeilds
- `GENTranslate_SectionCategory` — → BaseEntityFields, GENListValues, GENSectionCategories, PageOfPageFeilds
- `GENTranslate_Sections` — → BaseEntityFields, GENListValues, GENSections, PageOfPageFeilds
- `GENTranslate_ServiceCategory` — → BaseEntityFields, GENListValues, GENServiceCategories, PageOfPageFeilds
- `GENTranslate_Services` — → BaseEntityFields, GENListValues, GENServices, PageOfPageFeilds
- `GENTranslate_Source` — → BaseEntityFields, CRMSources, GENListValues, PageOfPageFeilds
- `GENTranslate_SourceType` — → BaseEntityFields, CRMSourceTypes, GENListValues, PageOfPageFeilds
- `GENTranslate_SpecificationGroup` — → BaseEntityFields, GENListValues, GENSpecificationGroups, PageOfPageFeilds
- `GENTranslate_Status` — → BaseEntityFields, GENListValues, GENStatus, PageOfPageFeilds
- `GENTranslate_StatusMessage` — → BaseEntityFields, GENListValues, GENStatusMessages, PageOfPageFeilds
- `GENTranslate_StatusMessageCategory` — → BaseEntityFields, GENListValues, GENStatusMessageCategories, PageOfPageFeilds
- `GENTranslate_Stop` — → BaseEntityFields, GENListValues, LOGStops, PageOfPageFeilds
- `GENTranslate_TabFeilds` — → BasetabGENPageOfPages_Field, GENListValues
- `GENTranslate_Tag` — → BaseEntityFields, GENListValues, GENTags, PageOfPageFeilds
- `GENTranslate_TicketType` — → BaseEntityFields, CRMSRVTicketTypes, GENListValues, PageOfPageFeilds
- `GENTranslate_TypeStatus` — → BaseEntityFields, GENListValues, GENTypeStatus, PageOfPageFeilds
- `GENTranslate_Unit` — → BaseEntityFields, GENListValues, GENUnits, PageOfPageFeilds
- `GENTranslate_UnitCategory` — → BaseEntityFields, GENListValues, GENUnitCategories, PageOfPageFeilds
- `GENTranslate_Vehicle` — → GENListValues, GENVehicles, PageOfPageFeilds
- `GENTranslate_VehicleType` — → BaseEntityFields, GENListValues, GENVehicleTypes, PageOfPageFeilds
- `GENTranslate_Vehicles` — → BaseEntityFields, GENListValues, GENVehicles, PageOfPageFeilds
- `GENTranslate_Zone` — → BaseEntityFields, GENListValues, GENZones, PageOfPageFeilds
- `GENUnitCategories` — → GENListValues, GENStyles | ← GENTranslate_UnitCategory, GENUnits
- `GENUserDevices` — → GENListValues
- `GENUserLikes` — → AspNetUsers, GENItems
- `GENUserLocations` — → GENContacts, GENEmployees, GENRequests
- `GENVehicleTypeImages` — → GENVehicleTypes
- `GENVehicleTypes` — → GENListValues, GENStyles | ← GENTranslate_VehicleType, GENVehicleTypeImages, GENVehicles
- `GENVehicleUsers` — → AspNetUsers, GENVehicles
- `GENVehicles` — → GENBrands, GENCompanies, GENContacts, GENEmployees, GENListValues, GENStatus, GENStyles, GENVehicleTypes | ← GENBulkRequests, GENRequests, GENTranslate_Vehicle, GENTranslate_Vehicles, GENVehicleUsers
- `GENWikiAudios` — → GENWikis
- `GENWikiFiles` — → GENWikis
- `GENZones` — → GENListValues, GENStyles | ← GENTranslate_Zone
- `ImportLogDatas` — → AspNetUsers, BaseEntities, CRMSRVReasons, CRMSources, GENCompanies, GENDepartments, GENListValues, GENPaymentMethods, GENRawDataTypes, GENSalutations, GENStatus, GENStyles, GENTypes, ImportLogs, RawDataCategories
- `ItemFlatDatas` — → GENListValues, GENStyles | ← CRMSRVTicket_Comment, CRMTickets, Items_Generic, TCRWorkItems
- `Items_Generic` — → CRMTickets, GENContacts, GENItems, GENListValues, GENStatus, ItemFlatDatas
- `LOGRoutePoints` — → LOGRoutes
- `LOGRoute_LOGStop` — → LOGRoutes, LOGStops
- `LOGRoutes` — → GENStyles | ← GENBulkRequests, GENRequestType_LOGStop, GENRequests, LOGRoutePoints, LOGRoute_LOGStop
- `LOGStops` — → GENStyles | ← GENBulkRequest_LOGStop, GENBulkRequests, GENRequestType_LOGStop, GENRequests, GENTranslate_Stop, LOGRoute_LOGStop
- `ListOfActions` — ← GENStatus
- `ListValueTypeCategories` — → GENListValues, GENStyles
- `LogMetadata` — → AuditLogs
- `RawDataCategories` — → GENListValues | ← GENRawDatas, GENTranslate_RawDataCategory, ImportLogDatas
- `RawDataImport` — isolated (no FKs)
- `RawDataImportFields` — isolated (no FKs)
- `Repositories` — → BaseEntities | ← RepositoryMethods
- `RepositoryMethods` — → Repositories
- `SchedulerContacts` — → CRMSRVTicket_Comment
- `TCRItems` — → CRMDealItems, CRMDeals, CRMQuoteItems, GENItems, GENProjects, GENTCRs, GENUnits | ← TCRWorkItems
- `TCRWorkItems` — → CRMDealItems, CRMDeals, GENItems, GENTCRs, ItemFlatDatas, TCRItems, TCRWorkOrders
- `TCRWorkOrders` — → GENBranches, GENBrands, GENTCRs | ← TCRWorkItems
- `TempTable` — isolated (no FKs)
- `TempVCRPollReport` — isolated (no FKs)
- `TicketInfoes` — isolated (no FKs)
- `Translate_Specification` — → BaseEntityFields, GENListValues, GENSpecifications, PageOfPageFeilds
- `temp_table_Company` — isolated (no FKs)

## Tables with no declared FKs

These have no FK constraints in the schema dump. Some still relate via soft IDs in app code (e.g. `AspNetUserRoles` uses composite keys without FK in older Identity schemas).

- `AgeGroupContacts` — 4 rows
- `AspNetUserRoles` — 16,227 rows
- `BedabSettings` — 0 rows
- `CheckOutHistories` — 55,300 rows
- `CompanyContactMerge` — 0 rows
- `CompanyContactMergeMirror` — 0 rows
- `CompanyImport` — 80 rows
- `CompanyImportFields` — 2 rows
- `CompanyInfoes` — 1,263 rows
- `CompanySettings` — 0 rows
- `ContactImport` — 14 rows
- `ContactImportFields` — 7 rows
- `DataBaseBackups` — 0 rows
- `DealInfoes` — 0 rows
- `EACA_NewContacts` — 0 rows
- `EmployeeInfoes` — 0 rows
- `FontSettings` — 21 rows
- `GENChatUserConnections` — 56,223 rows
- `GENClassroomsLogDatas` — 10 rows
- `GENDiscountCardImport` — 0 rows
- `GENDiscountCardImportFields` — 0 rows
- `GENDiscountCardLogDatas` — 0 rows
- `GENFilterEntities` — 9 rows
- `GENNextStatus` — 0 rows
- `GENOperationsLogs` — 17 rows
- `GENTranslate_GenericTab` — 386 rows
- `GENWikiImport` — 10 rows
- `GENWikiImportFields` — 3 rows
- `GENWikiLogDatas` — 20 rows
- `GenRoles` — 1,307 rows
- `LanguagePercentage` — 6 rows
- `PageOfPageField_Role` — 13,273 rows
- `RawDataImport` — 0 rows
- `RawDataImportFields` — 0 rows
- `Table` — 17 rows
- `TempGenTypeCategories` — 10 rows
- `TempRPTBulks` — 46 rows
- `TempSessions` — 470 rows
- `TempTable` — 0 rows
- `TempVCRPollReport` — 0 rows
- `TempVcrs` — 12 rows
- `TicketInfoes` — 0 rows
- `TypeImport` — 10 rows
- `TypeImportFields` — 7 rows
- `TypeLogDatas` — 10 rows
- `VCRContactImportDatas` — 31,268 rows
- `VCRContactImportFields` — 7 rows
- `__MigrationHistory` — 294 rows
- `temp_table_Company` — 0 rows

## Complete FK list (all constraints)

| Child table | Child columns | Parent table | Parent columns | Child rows | Parent rows |
|-------------|---------------|--------------|----------------|----------:|------------:|
| `AchievementsOpenBals` | `CompanyId` | `GENCompanies` | `Id` | 280 | 6,045 |
| `AchievementsOpenBals` | `ListOfValueId` | `GENListValues` | `Id` | 280 | 3,328 |
| `ActivityContacts` | `Ticket_CommentId` | `CRMSRVTicket_Comment` | `Id` | 0 | 0 |
| `ActivityEmployees` | `BaseEntityId` | `BaseEntities` | `Id` | 0 | 203 |
| `ActivityEmployees` | `TicketCommentId` | `CRMSRVTicket_Comment` | `Id` | 0 | 0 |
| `ActivityEmployees` | `EmployeeId` | `GENEmployees` | `Id` | 0 | 824 |
| `AspNetUserAddresses` | `UserId` | `AspNetUsers` | `Id` | 0 | 40,910 |
| `AspNetUserAddresses` | `AddressZoneId` | `GENAddressZones` | `Id` | 0 | 0 |
| `AspNetUserAddresses` | `AreaId` | `GENAreas` | `Id` | 0 | 0 |
| `AspNetUserAddresses` | `CityId` | `GENCities` | `Id` | 0 | 28 |
| `AspNetUserAddresses` | `CountryId` | `GENCountries` | `Id` | 0 | 174 |
| `AspNetUserAddresses` | `DistrictId` | `GENDistricts` | `Id` | 0 | 9 |
| `AspNetUserAddresses` | `GovernorateId` | `GENGovernorates` | `Id` | 0 | 9 |
| `AspNetUserAddresses` | `ProvinceId` | `GENProvinces` | `Id` | 0 | 2 |
| `AspNetUserAddresses` | `RegionsId` | `GENRegions` | `Id` | 0 | 8 |
| `AspNetUserClaims` | `UserId` | `AspNetUsers` | `Id` | 1 | 40,910 |
| `AspNetUserLogins` | `UserId` | `AspNetUsers` | `Id` | 0 | 40,910 |
| `AspNetUserPhones` | `UserId` | `AspNetUsers` | `Id` | 0 | 40,910 |
| `AspNetUsers` | `OfficialOrganizationId` | `GENCompanies` | `Id` | 40,910 | 6,045 |
| `AuditLogDetails` | `AuditLogId` | `AuditLogs` | `AuditLogId` | 4,147,652 | 968,393 |
| `AuthenticationPageOfPages` | `AccessCriteriaId` | `AccessCriterias` | `Id` | 0 | 0 |
| `AuthenticationPageOfPages` | `IdentityRoleId` | `AspNetRoles` | `Id` | 0 | 14 |
| `AuthenticationPageOfPages` | `PageOfPageId` | `GENPageOfPages` | `Id` | 0 | 348 |
| `Authentications` | `AccessCriteriaId` | `AccessCriterias` | `Id` | 624 | 0 |
| `Authentications` | `IdentityRoleId` | `AspNetRoles` | `Id` | 624 | 14 |
| `Authentications` | `BackendPageId` | `GENBackendPages` | `Id` | 624 | 261 |
| `BackEndSection_Entities` | `BaseEntityId` | `BaseEntities` | `Id` | 0 | 203 |
| `BaseEntityFields` | `BaseEntityId` | `BaseEntities` | `Id` | 7,185 | 203 |
| `BaseEntityRelations` | `BaseEntityId` | `BaseEntities` | `Id` | 573 | 203 |
| `BaseEntityURLS` | `BaseEntityId` | `BaseEntities` | `Id` | 0 | 203 |
| `BaseTabBaseEntities` | `BaseEntity_Id` | `BaseEntities` | `Id` | 662 | 203 |
| `BaseTabBaseEntities` | `BaseTab_Id` | `BaseTabs` | `Id` | 662 | 106 |
| `BaseTabFields` | `BaseEntityId` | `BaseEntities` | `Id` | 335 | 203 |
| `BaseTabFields` | `BaseTabId` | `BaseTabs` | `Id` | 335 | 106 |
| `BaseTabFields` | `FieldTypeId` | `GENListValues` | `Id` | 335 | 3,328 |
| `BaseTabGENPageOfPages` | `BaseEntityId` | `BaseEntities` | `Id` | 1,207 | 203 |
| `BaseTabGENPageOfPages` | `BaseTabId` | `BaseTabs` | `Id` | 1,207 | 106 |
| `BaseTabGENPageOfPages` | `ImageTypeId` | `GENImageTypes` | `Id` | 1,207 | 95 |
| `BaseTabGENPageOfPages` | `GENPageOfPagesId` | `GENPageOfPages` | `Id` | 1,207 | 348 |
| `BaseTabGENPageOfPages` | `ReferPageofPageId` | `GENPageOfPages` | `Id` | 1,207 | 348 |
| `BaseTabGENPageOfPages` | `SearchPageId` | `GENPageOfPages` | `Id` | 1,207 | 348 |
| `BasetabGENPageOfPagesRoles` | `RoleId` | `AspNetRoles` | `Id` | 902 | 14 |
| `BasetabGENPageOfPages_Field` | `BaseEntityId` | `BaseEntities` | `Id` | 1,004 | 203 |
| `BasetabGENPageOfPages_Field` | `BaseTabFieldId` | `BaseTabFields` | `Id` | 1,004 | 335 |
| `BasetabGENPageOfPages_Field` | `PageOfPagesBaseTabId` | `BaseTabGENPageOfPages` | `Id` | 1,004 | 1,207 |
| `CRMClient_Contact` | `ContactId` | `GENContacts` | `Id` | 0 | 51,607 |
| `CRMDealItems` | `DealId` | `CRMDeals` | `Id` | 0 | 0 |
| `CRMDealItems` | `ItemId` | `GENItems` | `Id` | 0 | 5,180 |
| `CRMDealItems` | `ProjectId` | `GENProjects` | `Id` | 0 | 0 |
| `CRMDealItems` | `UnitId` | `GENUnits` | `Id` | 0 | 1 |
| `CRMDealTypes` | `ValueId1` | `GENListValues` | `Id` | 2 | 3,328 |
| `CRMDealTypes` | `ValueId2` | `GENListValues` | `Id` | 2 | 3,328 |
| `CRMDealTypes` | `ValueId3` | `GENListValues` | `Id` | 2 | 3,328 |
| `CRMDealTypes` | `ValueId4` | `GENListValues` | `Id` | 2 | 3,328 |
| `CRMDealTypes` | `ValueId5` | `GENListValues` | `Id` | 2 | 3,328 |
| `CRMDealTypes` | `IconId` | `GENStyles` | `Id` | 2 | 1,445 |
| `CRMDeals` | `DealTypeId` | `CRMDealTypes` | `Id` | 0 | 2 |
| `CRMDeals` | `ReasonId` | `CRMSRVReasons` | `Id` | 0 | 0 |
| `CRMDeals` | `SourceId` | `CRMSources` | `Id` | 0 | 18 |
| `CRMDeals` | `CompanyId` | `GENCompanies` | `Id` | 0 | 6,045 |
| `CRMDeals` | `ContactId` | `GENContacts` | `Id` | 0 | 51,607 |
| `CRMDeals` | `CurrencyId` | `GENCurrencies` | `Id` | 0 | 2 |
| `CRMDeals` | `EscalatedById` | `GENEmployees` | `Id` | 0 | 824 |
| `CRMDeals` | `EscalatedTo` | `GENEmployees` | `Id` | 0 | 824 |
| `CRMDeals` | `ResponsiblePersonId` | `GENEmployees` | `Id` | 0 | 824 |
| `CRMDeals` | `AssessmentId` | `GENListValues` | `Id` | 0 | 3,328 |
| `CRMDeals` | `PriortyId` | `GENListValues` | `Id` | 0 | 3,328 |
| `CRMDeals` | `RentPeriodId` | `GENListValues` | `Id` | 0 | 3,328 |
| `CRMDeals` | `ValueId1` | `GENListValues` | `Id` | 0 | 3,328 |
| `CRMDeals` | `ValueId2` | `GENListValues` | `Id` | 0 | 3,328 |
| `CRMDeals` | `ValueId3` | `GENListValues` | `Id` | 0 | 3,328 |
| `CRMDeals` | `ValueId4` | `GENListValues` | `Id` | 0 | 3,328 |
| `CRMDeals` | `ValueId5` | `GENListValues` | `Id` | 0 | 3,328 |
| `CRMDeals` | `PaymentMethodId` | `GENPaymentMethods` | `Id` | 0 | 7 |
| `CRMDeals` | `StatusId` | `GENStatus` | `Id` | 0 | 9 |
| `CRMDeals` | `IconId` | `GENStyles` | `Id` | 0 | 1,445 |
| `CRMDeals` | `TypeId` | `GENTypes` | `Id` | 0 | 416 |
| `CRMQuoteComments` | `QuoteId` | `CRMQuotes` | `Id` | 0 | 0 |
| `CRMQuoteItems` | `DealId` | `CRMDeals` | `Id` | 0 | 0 |
| `CRMQuoteItems` | `QuoteId` | `CRMQuotes` | `Id` | 0 | 0 |
| `CRMQuoteItems` | `ItemId` | `GENItems` | `Id` | 0 | 5,180 |
| `CRMQuoteItems` | `NoteListValueId` | `GENListValues` | `Id` | 0 | 3,328 |
| `CRMQuoteItems` | `ProjectId` | `GENProjects` | `Id` | 0 | 0 |
| `CRMQuoteItems` | `UnitId` | `GENUnits` | `Id` | 0 | 1 |
| `CRMQuoteStatus` | `ValueId1` | `GENListValues` | `Id` | 0 | 3,328 |
| `CRMQuoteStatus` | `ValueId2` | `GENListValues` | `Id` | 0 | 3,328 |
| `CRMQuoteStatus` | `ValueId3` | `GENListValues` | `Id` | 0 | 3,328 |
| `CRMQuoteStatus` | `ValueId4` | `GENListValues` | `Id` | 0 | 3,328 |
| `CRMQuoteStatus` | `ValueId5` | `GENListValues` | `Id` | 0 | 3,328 |
| `CRMQuoteStatus` | `IconId` | `GENStyles` | `Id` | 0 | 1,445 |
| `CRMQuoteTypes` | `ValueId1` | `GENListValues` | `Id` | 0 | 3,328 |
| `CRMQuoteTypes` | `ValueId2` | `GENListValues` | `Id` | 0 | 3,328 |
| `CRMQuoteTypes` | `ValueId3` | `GENListValues` | `Id` | 0 | 3,328 |
| `CRMQuoteTypes` | `ValueId4` | `GENListValues` | `Id` | 0 | 3,328 |
| `CRMQuoteTypes` | `ValueId5` | `GENListValues` | `Id` | 0 | 3,328 |
| `CRMQuoteTypes` | `IconId` | `GENStyles` | `Id` | 0 | 1,445 |
| `CRMQuotes` | `DealTypeId` | `CRMDealTypes` | `Id` | 0 | 2 |
| `CRMQuotes` | `DealId` | `CRMDeals` | `Id` | 0 | 0 |
| `CRMQuotes` | `QuoteTypeId` | `CRMQuoteTypes` | `Id` | 0 | 0 |
| `CRMQuotes` | `ReasonId` | `CRMSRVReasons` | `Id` | 0 | 0 |
| `CRMQuotes` | `SourceId` | `CRMSources` | `Id` | 0 | 18 |
| `CRMQuotes` | `CompanyId` | `GENCompanies` | `Id` | 0 | 6,045 |
| `CRMQuotes` | `DealCompanyId` | `GENCompanies` | `Id` | 0 | 6,045 |
| `CRMQuotes` | `ContactId` | `GENContacts` | `Id` | 0 | 51,607 |
| `CRMQuotes` | `DealContactId` | `GENContacts` | `Id` | 0 | 51,607 |
| `CRMQuotes` | `DealCurrencyId` | `GENCurrencies` | `Id` | 0 | 2 |
| `CRMQuotes` | `DealResponsiblePersonId` | `GENEmployees` | `Id` | 0 | 824 |
| `CRMQuotes` | `EmployeeId` | `GENEmployees` | `Id` | 0 | 824 |
| `CRMQuotes` | `AssessmentId` | `GENListValues` | `Id` | 0 | 3,328 |
| `CRMQuotes` | `NoteListValueId` | `GENListValues` | `Id` | 0 | 3,328 |
| `CRMQuotes` | `PriortyId` | `GENListValues` | `Id` | 0 | 3,328 |
| `CRMQuotes` | `RentPeriodId` | `GENListValues` | `Id` | 0 | 3,328 |
| `CRMQuotes` | `ValueId1` | `GENListValues` | `Id` | 0 | 3,328 |
| `CRMQuotes` | `ValueId2` | `GENListValues` | `Id` | 0 | 3,328 |
| `CRMQuotes` | `ValueId3` | `GENListValues` | `Id` | 0 | 3,328 |
| `CRMQuotes` | `ValueId4` | `GENListValues` | `Id` | 0 | 3,328 |
| `CRMQuotes` | `ValueId5` | `GENListValues` | `Id` | 0 | 3,328 |
| `CRMQuotes` | `PaymentMethodId` | `GENPaymentMethods` | `Id` | 0 | 7 |
| `CRMQuotes` | `StatusId` | `GENStatus` | `Id` | 0 | 9 |
| `CRMQuotes` | `IconId` | `GENStyles` | `Id` | 0 | 1,445 |
| `CRMQuotes` | `TypeId` | `GENTypes` | `Id` | 0 | 416 |
| `CRMSRVIssueTypes` | `ParentId` | `CRMSRVIssueTypes` | `Id` | 0 | 0 |
| `CRMSRVIssueTypes` | `ValueId1` | `GENListValues` | `Id` | 0 | 3,328 |
| `CRMSRVIssueTypes` | `ValueId2` | `GENListValues` | `Id` | 0 | 3,328 |
| `CRMSRVIssueTypes` | `ValueId3` | `GENListValues` | `Id` | 0 | 3,328 |
| `CRMSRVIssueTypes` | `ValueId4` | `GENListValues` | `Id` | 0 | 3,328 |
| `CRMSRVIssueTypes` | `ValueId5` | `GENListValues` | `Id` | 0 | 3,328 |
| `CRMSRVIssueTypes` | `IconId` | `GENStyles` | `Id` | 0 | 1,445 |
| `CRMSRVIssues` | `CreatedById` | `AspNetUsers` | `Id` | 0 | 40,910 |
| `CRMSRVIssues` | `DeletedById` | `AspNetUsers` | `Id` | 0 | 40,910 |
| `CRMSRVIssues` | `LastUpdatedById` | `AspNetUsers` | `Id` | 0 | 40,910 |
| `CRMSRVIssues` | `IssueTypeId` | `CRMSRVIssueTypes` | `Id` | 0 | 0 |
| `CRMSRVIssues` | `CategoryId` | `GENItemCategories` | `Id` | 0 | 3 |
| `CRMSRVIssues` | `ValueId1` | `GENListValues` | `Id` | 0 | 3,328 |
| `CRMSRVIssues` | `ValueId2` | `GENListValues` | `Id` | 0 | 3,328 |
| `CRMSRVIssues` | `ValueId3` | `GENListValues` | `Id` | 0 | 3,328 |
| `CRMSRVIssues` | `ValueId4` | `GENListValues` | `Id` | 0 | 3,328 |
| `CRMSRVIssues` | `ValueId5` | `GENListValues` | `Id` | 0 | 3,328 |
| `CRMSRVIssues` | `IconId` | `GENStyles` | `Id` | 0 | 1,445 |
| `CRMSRVMaintenanceRoleCategories` | `CreatedById` | `AspNetUsers` | `Id` | 0 | 40,910 |
| `CRMSRVMaintenanceRoleCategories` | `DeletedById` | `AspNetUsers` | `Id` | 0 | 40,910 |
| `CRMSRVMaintenanceRoleCategories` | `LastUpdatedById` | `AspNetUsers` | `Id` | 0 | 40,910 |
| `CRMSRVMaintenanceRoleCategories` | `ValueId1` | `GENListValues` | `Id` | 0 | 3,328 |
| `CRMSRVMaintenanceRoleCategories` | `ValueId2` | `GENListValues` | `Id` | 0 | 3,328 |
| `CRMSRVMaintenanceRoleCategories` | `ValueId3` | `GENListValues` | `Id` | 0 | 3,328 |
| `CRMSRVMaintenanceRoleCategories` | `ValueId4` | `GENListValues` | `Id` | 0 | 3,328 |
| `CRMSRVMaintenanceRoleCategories` | `ValueId5` | `GENListValues` | `Id` | 0 | 3,328 |
| `CRMSRVMaintenanceRoleCategories` | `IconId` | `GENStyles` | `Id` | 0 | 1,445 |
| `CRMSRVMaintenanceRoles` | `CreatedById` | `AspNetUsers` | `Id` | 0 | 40,910 |
| `CRMSRVMaintenanceRoles` | `DeletedById` | `AspNetUsers` | `Id` | 0 | 40,910 |
| `CRMSRVMaintenanceRoles` | `LastUpdatedById` | `AspNetUsers` | `Id` | 0 | 40,910 |
| `CRMSRVMaintenanceRoles` | `MaintainceCategoryId` | `CRMSRVMaintenanceRoleCategories` | `Id` | 0 | 0 |
| `CRMSRVMaintenanceRoles` | `ValueId1` | `GENListValues` | `Id` | 0 | 3,328 |
| `CRMSRVMaintenanceRoles` | `ValueId2` | `GENListValues` | `Id` | 0 | 3,328 |
| `CRMSRVMaintenanceRoles` | `ValueId3` | `GENListValues` | `Id` | 0 | 3,328 |
| `CRMSRVMaintenanceRoles` | `ValueId4` | `GENListValues` | `Id` | 0 | 3,328 |
| `CRMSRVMaintenanceRoles` | `ValueId5` | `GENListValues` | `Id` | 0 | 3,328 |
| `CRMSRVMaintenanceRoles` | `IconId` | `GENStyles` | `Id` | 0 | 1,445 |
| `CRMSRVReasonTypes` | `CreatedById` | `AspNetUsers` | `Id` | 0 | 40,910 |
| `CRMSRVReasonTypes` | `LastUpdatedById` | `AspNetUsers` | `Id` | 0 | 40,910 |
| `CRMSRVReasonTypes` | `ValueId1` | `GENListValues` | `Id` | 0 | 3,328 |
| `CRMSRVReasonTypes` | `ValueId2` | `GENListValues` | `Id` | 0 | 3,328 |
| `CRMSRVReasonTypes` | `ValueId3` | `GENListValues` | `Id` | 0 | 3,328 |
| `CRMSRVReasonTypes` | `ValueId4` | `GENListValues` | `Id` | 0 | 3,328 |
| `CRMSRVReasonTypes` | `ValueId5` | `GENListValues` | `Id` | 0 | 3,328 |
| `CRMSRVReasonTypes` | `IconId` | `GENStyles` | `Id` | 0 | 1,445 |
| `CRMSRVReasons` | `CreatedById` | `AspNetUsers` | `Id` | 0 | 40,910 |
| `CRMSRVReasons` | `LastUpdatedById` | `AspNetUsers` | `Id` | 0 | 40,910 |
| `CRMSRVReasons` | `ReasonTypeId` | `CRMSRVReasonTypes` | `Id` | 0 | 0 |
| `CRMSRVReasons` | `ClassificationId` | `GENListValues` | `Id` | 0 | 3,328 |
| `CRMSRVReasons` | `ValueId1` | `GENListValues` | `Id` | 0 | 3,328 |
| `CRMSRVReasons` | `ValueId2` | `GENListValues` | `Id` | 0 | 3,328 |
| `CRMSRVReasons` | `ValueId3` | `GENListValues` | `Id` | 0 | 3,328 |
| `CRMSRVReasons` | `ValueId4` | `GENListValues` | `Id` | 0 | 3,328 |
| `CRMSRVReasons` | `ValueId5` | `GENListValues` | `Id` | 0 | 3,328 |
| `CRMSRVReasons` | `IconId` | `GENStyles` | `Id` | 0 | 1,445 |
| `CRMSRVRequesterAddresses` | `RequesterId` | `CRMSRVRequesters` | `Id` | 0 | 0 |
| `CRMSRVRequesterAddresses` | `CityId` | `GENCities` | `Id` | 0 | 28 |
| `CRMSRVRequesterAddresses` | `CountryId` | `GENCountries` | `Id` | 0 | 174 |
| `CRMSRVRequesterAddresses` | `RegionId` | `GENRegions1` | `Id` | 0 | 0 |
| `CRMSRVRequesterEmails` | `RequesterId` | `CRMSRVRequesters` | `Id` | 0 | 0 |
| `CRMSRVRequesterPhones` | `RequesterId` | `CRMSRVRequesters` | `Id` | 0 | 0 |
| `CRMSRVRequesterTypes` | `ValueId1` | `GENListValues` | `Id` | 0 | 3,328 |
| `CRMSRVRequesterTypes` | `ValueId2` | `GENListValues` | `Id` | 0 | 3,328 |
| `CRMSRVRequesterTypes` | `ValueId3` | `GENListValues` | `Id` | 0 | 3,328 |
| `CRMSRVRequesterTypes` | `ValueId4` | `GENListValues` | `Id` | 0 | 3,328 |
| `CRMSRVRequesterTypes` | `ValueId5` | `GENListValues` | `Id` | 0 | 3,328 |
| `CRMSRVRequesterTypes` | `IconId` | `GENStyles` | `Id` | 0 | 1,445 |
| `CRMSRVRequesters` | `RequesterTypeId` | `CRMSRVRequesterTypes` | `Id` | 0 | 0 |
| `CRMSRVRequesters` | `MainContactId` | `GENEmployees` | `Id` | 0 | 824 |
| `CRMSRVRequesters` | `IndustryId` | `GENIndustries` | `Id` | 0 | 25 |
| `CRMSRVRequesters` | `ValueId1` | `GENListValues` | `Id` | 0 | 3,328 |
| `CRMSRVRequesters` | `ValueId2` | `GENListValues` | `Id` | 0 | 3,328 |
| `CRMSRVRequesters` | `ValueId3` | `GENListValues` | `Id` | 0 | 3,328 |
| `CRMSRVRequesters` | `ValueId4` | `GENListValues` | `Id` | 0 | 3,328 |
| `CRMSRVRequesters` | `ValueId5` | `GENListValues` | `Id` | 0 | 3,328 |
| `CRMSRVRequesters` | `IconId` | `GENStyles` | `Id` | 0 | 1,445 |
| `CRMSRVRequestersRatigs` | `CRMSRVRequestersId` | `CRMSRVRequesters` | `Id` | 0 | 0 |
| `CRMSRVReservations` | `CreatedById` | `AspNetUsers` | `Id` | 0 | 40,910 |
| `CRMSRVReservations` | `DeletedById` | `AspNetUsers` | `Id` | 0 | 40,910 |
| `CRMSRVReservations` | `LastUpdatedById` | `AspNetUsers` | `Id` | 0 | 40,910 |
| `CRMSRVReservations` | `BranchId` | `GENBranches` | `Id` | 0 | 2 |
| `CRMSRVReservations` | `ValueId1` | `GENListValues` | `Id` | 0 | 3,328 |
| `CRMSRVReservations` | `ValueId2` | `GENListValues` | `Id` | 0 | 3,328 |
| `CRMSRVReservations` | `ValueId3` | `GENListValues` | `Id` | 0 | 3,328 |
| `CRMSRVReservations` | `ValueId4` | `GENListValues` | `Id` | 0 | 3,328 |
| `CRMSRVReservations` | `ValueId5` | `GENListValues` | `Id` | 0 | 3,328 |
| `CRMSRVReservations` | `GENStatusId` | `GENStatus` | `Id` | 0 | 9 |
| `CRMSRVReservations` | `IconId` | `GENStyles` | `Id` | 0 | 1,445 |
| `CRMSRVTicketTypes` | `CreatedById` | `AspNetUsers` | `Id` | 4 | 40,910 |
| `CRMSRVTicketTypes` | `DeletedById` | `AspNetUsers` | `Id` | 4 | 40,910 |
| `CRMSRVTicketTypes` | `LastUpdatedById` | `AspNetUsers` | `Id` | 4 | 40,910 |
| `CRMSRVTicketTypes` | `ValueId1` | `GENListValues` | `Id` | 4 | 3,328 |
| `CRMSRVTicketTypes` | `ValueId2` | `GENListValues` | `Id` | 4 | 3,328 |
| `CRMSRVTicketTypes` | `ValueId3` | `GENListValues` | `Id` | 4 | 3,328 |
| `CRMSRVTicketTypes` | `ValueId4` | `GENListValues` | `Id` | 4 | 3,328 |
| `CRMSRVTicketTypes` | `ValueId5` | `GENListValues` | `Id` | 4 | 3,328 |
| `CRMSRVTicketTypes` | `IconId` | `GENStyles` | `Id` | 4 | 1,445 |
| `CRMSRVTicketVisits` | `ReasonId` | `CRMSRVReasons` | `Id` | 0 | 0 |
| `CRMSRVTicketVisits` | `TicketId` | `CRMSRVTickets` | `Id` | 0 | 0 |
| `CRMSRVTicketVisits` | `EmployeeId` | `GENEmployees` | `Id` | 0 | 824 |
| `CRMSRVTicket_BranchTransfer` | `CreatedById` | `AspNetUsers` | `Id` | 0 | 40,910 |
| `CRMSRVTicket_BranchTransfer` | `DeletedById` | `AspNetUsers` | `Id` | 0 | 40,910 |
| `CRMSRVTicket_BranchTransfer` | `LastUpdatedById` | `AspNetUsers` | `Id` | 0 | 40,910 |
| `CRMSRVTicket_BranchTransfer` | `ReasonId` | `CRMSRVReasons` | `Id` | 0 | 0 |
| `CRMSRVTicket_BranchTransfer` | `TicketId` | `CRMSRVTickets` | `Id` | 0 | 0 |
| `CRMSRVTicket_BranchTransfer` | `BranchToId` | `GENBranches` | `Id` | 0 | 2 |
| `CRMSRVTicket_BranchTransfer` | `DelieveredById` | `GENEmployees` | `Id` | 0 | 824 |
| `CRMSRVTicket_BranchTransfer` | `DeliveryStatusId` | `GENStatus` | `Id` | 0 | 9 |
| `CRMSRVTicket_Comment` | `CreatedById` | `AspNetUsers` | `Id` | 0 | 40,910 |
| `CRMSRVTicket_Comment` | `DeletedById` | `AspNetUsers` | `Id` | 0 | 40,910 |
| `CRMSRVTicket_Comment` | `LastUpdatedById` | `AspNetUsers` | `Id` | 0 | 40,910 |
| `CRMSRVTicket_Comment` | `BaseEntityId` | `BaseEntities` | `Id` | 0 | 203 |
| `CRMSRVTicket_Comment` | `TicketId` | `CRMSRVTickets` | `Id` | 0 | 0 |
| `CRMSRVTicket_Comment` | `CRMTicketId` | `CRMTickets` | `Id` | 0 | 0 |
| `CRMSRVTicket_Comment` | `ActionTypeId` | `GENCommentTypes` | `Id` | 0 | 7 |
| `CRMSRVTicket_Comment` | `CommentTypeId` | `GENCommentTypes` | `Id` | 0 | 7 |
| `CRMSRVTicket_Comment` | `NextActionId` | `GENCommentTypes` | `Id` | 0 | 7 |
| `CRMSRVTicket_Comment` | `MainContactId` | `GENContacts` | `Id` | 0 | 51,607 |
| `CRMSRVTicket_Comment` | `ItemId` | `GENItems` | `Id` | 0 | 5,180 |
| `CRMSRVTicket_Comment` | `ListValueId` | `GENListValues` | `Id` | 0 | 3,328 |
| `CRMSRVTicket_Comment` | `RepeatPeriodId` | `GENListValues` | `Id` | 0 | 3,328 |
| `CRMSRVTicket_Comment` | `ValueId1` | `GENListValues` | `Id` | 0 | 3,328 |
| `CRMSRVTicket_Comment` | `ValueId2` | `GENListValues` | `Id` | 0 | 3,328 |
| `CRMSRVTicket_Comment` | `ValueId3` | `GENListValues` | `Id` | 0 | 3,328 |
| `CRMSRVTicket_Comment` | `ValueId4` | `GENListValues` | `Id` | 0 | 3,328 |
| `CRMSRVTicket_Comment` | `ValueId5` | `GENListValues` | `Id` | 0 | 3,328 |
| `CRMSRVTicket_Comment` | `PageofPagesId` | `GENPageOfPages` | `Id` | 0 | 348 |
| `CRMSRVTicket_Comment` | `PaymentMethodId` | `GENPaymentMethods` | `Id` | 0 | 7 |
| `CRMSRVTicket_Comment` | `StatusId` | `GENStatus` | `Id` | 0 | 9 |
| `CRMSRVTicket_Comment` | `ItemFlatDataId` | `ItemFlatDatas` | `Id` | 0 | 0 |
| `CRMSRVTicket_Issue` | `CreatedById` | `AspNetUsers` | `Id` | 0 | 40,910 |
| `CRMSRVTicket_Issue` | `DeletedById` | `AspNetUsers` | `Id` | 0 | 40,910 |
| `CRMSRVTicket_Issue` | `LastUpdatedById` | `AspNetUsers` | `Id` | 0 | 40,910 |
| `CRMSRVTicket_Issue` | `IssueId` | `CRMSRVIssues` | `Id` | 0 | 0 |
| `CRMSRVTicket_Issue` | `TicketId` | `CRMSRVTickets` | `Id` | 0 | 0 |
| `CRMSRVTicket_ItemAttachment` | `CreatedById` | `AspNetUsers` | `Id` | 0 | 40,910 |
| `CRMSRVTicket_ItemAttachment` | `DeletedById` | `AspNetUsers` | `Id` | 0 | 40,910 |
| `CRMSRVTicket_ItemAttachment` | `LastUpdatedById` | `AspNetUsers` | `Id` | 0 | 40,910 |
| `CRMSRVTicket_ItemAttachment` | `TicketId` | `CRMSRVTickets` | `Id` | 0 | 0 |
| `CRMSRVTicket_ItemAttachment` | `ItemAttachmentId` | `GENItems` | `Id` | 0 | 5,180 |
| `CRMSRVTicket_MaintenanceWork` | `CreatedById` | `AspNetUsers` | `Id` | 0 | 40,910 |
| `CRMSRVTicket_MaintenanceWork` | `DeletedById` | `AspNetUsers` | `Id` | 0 | 40,910 |
| `CRMSRVTicket_MaintenanceWork` | `LastUpdatedById` | `AspNetUsers` | `Id` | 0 | 40,910 |
| `CRMSRVTicket_MaintenanceWork` | `MaintainanceRoleId` | `CRMSRVMaintenanceRoles` | `Id` | 0 | 0 |
| `CRMSRVTicket_MaintenanceWork` | `TicketId` | `CRMSRVTickets` | `Id` | 0 | 0 |
| `CRMSRVTicket_MaintenanceWork` | `EmployeeId` | `GENEmployees` | `Id` | 0 | 824 |
| `CRMSRVTicket_MaintenanceWork` | `StatusId` | `GENStatus` | `Id` | 0 | 9 |
| `CRMSRVTicket_Sparepart` | `CreatedById` | `AspNetUsers` | `Id` | 0 | 40,910 |
| `CRMSRVTicket_Sparepart` | `DeletedById` | `AspNetUsers` | `Id` | 0 | 40,910 |
| `CRMSRVTicket_Sparepart` | `LastUpdatedById` | `AspNetUsers` | `Id` | 0 | 40,910 |
| `CRMSRVTicket_Sparepart` | `TicketId` | `CRMSRVTickets` | `Id` | 0 | 0 |
| `CRMSRVTicket_Sparepart` | `ItemId` | `GENItems` | `Id` | 0 | 5,180 |
| `CRMSRVTickets` | `CreatedById` | `AspNetUsers` | `Id` | 0 | 40,910 |
| `CRMSRVTickets` | `DeletedById` | `AspNetUsers` | `Id` | 0 | 40,910 |
| `CRMSRVTickets` | `LastUpdatedById` | `AspNetUsers` | `Id` | 0 | 40,910 |
| `CRMSRVTickets` | `ReceiptReasonId` | `CRMSRVReasons` | `Id` | 0 | 0 |
| `CRMSRVTickets` | `CRMTicketTypeId` | `CRMSRVTicketTypes` | `Id` | 0 | 4 |
| `CRMSRVTickets` | `BranchId` | `GENBranches` | `Id` | 0 | 2 |
| `CRMSRVTickets` | `GENCompanyId` | `GENCompanies` | `Id` | 0 | 6,045 |
| `CRMSRVTickets` | `ContactId` | `GENContacts` | `Id` | 0 | 51,607 |
| `CRMSRVTickets` | `CategoryId` | `GENItemCategories` | `Id` | 0 | 3 |
| `CRMSRVTickets` | `ItemId` | `GENItems` | `Id` | 0 | 5,180 |
| `CRMSRVTickets` | `ValueId1` | `GENListValues` | `Id` | 0 | 3,328 |
| `CRMSRVTickets` | `ValueId2` | `GENListValues` | `Id` | 0 | 3,328 |
| `CRMSRVTickets` | `ValueId3` | `GENListValues` | `Id` | 0 | 3,328 |
| `CRMSRVTickets` | `ValueId4` | `GENListValues` | `Id` | 0 | 3,328 |
| `CRMSRVTickets` | `ValueId5` | `GENListValues` | `Id` | 0 | 3,328 |
| `CRMSRVTickets` | `GENStatusId` | `GENStatus` | `Id` | 0 | 9 |
| `CRMSRVTickets` | `IconId` | `GENStyles` | `Id` | 0 | 1,445 |
| `CRMSentEmails` | `ValueId1` | `GENListValues` | `Id` | 52 | 3,328 |
| `CRMSentEmails` | `ValueId2` | `GENListValues` | `Id` | 52 | 3,328 |
| `CRMSentEmails` | `ValueId3` | `GENListValues` | `Id` | 52 | 3,328 |
| `CRMSentEmails` | `ValueId4` | `GENListValues` | `Id` | 52 | 3,328 |
| `CRMSentEmails` | `ValueId5` | `GENListValues` | `Id` | 52 | 3,328 |
| `CRMSentEmails` | `EmailEntityPoPId` | `GENPageOfPages` | `Id` | 52 | 348 |
| `CRMSentEmails` | `IconId` | `GENStyles` | `Id` | 52 | 1,445 |
| `CRMSourceTypes` | `ValueId1` | `GENListValues` | `Id` | 1 | 3,328 |
| `CRMSourceTypes` | `ValueId2` | `GENListValues` | `Id` | 1 | 3,328 |
| `CRMSourceTypes` | `ValueId3` | `GENListValues` | `Id` | 1 | 3,328 |
| `CRMSourceTypes` | `ValueId4` | `GENListValues` | `Id` | 1 | 3,328 |
| `CRMSourceTypes` | `ValueId5` | `GENListValues` | `Id` | 1 | 3,328 |
| `CRMSources` | `ValueId1` | `GENListValues` | `Id` | 18 | 3,328 |
| `CRMSources` | `ValueId2` | `GENListValues` | `Id` | 18 | 3,328 |
| `CRMSources` | `ValueId3` | `GENListValues` | `Id` | 18 | 3,328 |
| `CRMSources` | `ValueId4` | `GENListValues` | `Id` | 18 | 3,328 |
| `CRMSources` | `ValueId5` | `GENListValues` | `Id` | 18 | 3,328 |
| `CRMTicket_RelatedTicket` | `CRMTicketMainId` | `CRMTickets` | `Id` | 0 | 0 |
| `CRMTicket_RelatedTicket` | `CRMTicketRelatedId` | `CRMTickets` | `Id` | 0 | 0 |
| `CRMTickets` | `ReasonTypeId` | `CRMSRVReasonTypes` | `Id` | 0 | 0 |
| `CRMTickets` | `ReasonId` | `CRMSRVReasons` | `Id` | 0 | 0 |
| `CRMTickets` | `TicketTypeId` | `CRMSRVTicketTypes` | `Id` | 0 | 4 |
| `CRMTickets` | `SourceId` | `CRMSources` | `Id` | 0 | 18 |
| `CRMTickets` | `CRMTicketId` | `CRMTickets` | `Id` | 0 | 0 |
| `CRMTickets` | `BranchId` | `GENBranches` | `Id` | 0 | 2 |
| `CRMTickets` | `BrandId` | `GENBrands` | `Id` | 0 | 10 |
| `CRMTickets` | `CompanyId` | `GENCompanies` | `Id` | 0 | 6,045 |
| `CRMTickets` | `ContactCategoryId` | `GENContactCategories` | `Id` | 0 | 3 |
| `CRMTickets` | `ContactId` | `GENContacts` | `Id` | 0 | 51,607 |
| `CRMTickets` | `CurrencyId` | `GENCurrencies` | `Id` | 0 | 2 |
| `CRMTickets` | `EmployeeId` | `GENEmployees` | `Id` | 0 | 824 |
| `CRMTickets` | `EscalatedById` | `GENEmployees` | `Id` | 0 | 824 |
| `CRMTickets` | `EscalatedTo` | `GENEmployees` | `Id` | 0 | 824 |
| `CRMTickets` | `ItemId` | `GENItems` | `Id` | 0 | 5,180 |
| `CRMTickets` | `AssessmentId` | `GENListValues` | `Id` | 0 | 3,328 |
| `CRMTickets` | `ClassificationId` | `GENListValues` | `Id` | 0 | 3,328 |
| `CRMTickets` | `PriortyId` | `GENListValues` | `Id` | 0 | 3,328 |
| `CRMTickets` | `RentPeriodId` | `GENListValues` | `Id` | 0 | 3,328 |
| `CRMTickets` | `SatisfactionId` | `GENListValues` | `Id` | 0 | 3,328 |
| `CRMTickets` | `ValueId1` | `GENListValues` | `Id` | 0 | 3,328 |
| `CRMTickets` | `ValueId2` | `GENListValues` | `Id` | 0 | 3,328 |
| `CRMTickets` | `ValueId3` | `GENListValues` | `Id` | 0 | 3,328 |
| `CRMTickets` | `ValueId4` | `GENListValues` | `Id` | 0 | 3,328 |
| `CRMTickets` | `ValueId5` | `GENListValues` | `Id` | 0 | 3,328 |
| `CRMTickets` | `PaymentMethodId` | `GENPaymentMethods` | `Id` | 0 | 7 |
| `CRMTickets` | `StatusId` | `GENStatus` | `Id` | 0 | 9 |
| `CRMTickets` | `IconId` | `GENStyles` | `Id` | 0 | 1,445 |
| `CRMTickets` | `ItemFlatDataId` | `ItemFlatDatas` | `Id` | 0 | 0 |
| `CSHTransactions` | `TicketId` | `CRMSRVTickets` | `Id` | 0 | 0 |
| `CSHTransactions` | `ListValueId` | `GENListValues` | `Id` | 0 | 3,328 |
| `CandidateEmployees` | `CreatedById` | `AspNetUsers` | `Id` | 0 | 40,910 |
| `CandidateEmployees` | `LastUpdatedById` | `AspNetUsers` | `Id` | 0 | 40,910 |
| `CandidateEmployees` | `EmployeeId` | `GENEmployees` | `Id` | 0 | 824 |
| `Classroom_Attendance` | `ClassroomId` | `GENClassrooms` | `Id` | 426,960 | 2,996 |
| `Classroom_Attendance` | `StudentId` | `GENContacts` | `Id` | 426,960 | 51,607 |
| `Classroom_Attendance` | `SessionId` | `GENItems` | `Id` | 426,960 | 5,180 |
| `Classroom_Attendance` | `ExecuseId` | `GENListValues` | `Id` | 426,960 | 3,328 |
| `Classroom_Session_Instructor` | `CurrencyId` | `GENCurrencies` | `Id` | 15,634 | 2 |
| `Classroom_Session_Instructor` | `InstructorId` | `GENEmployees` | `Id` | 15,634 | 824 |
| `Classroom_Session_Instructor` | `GENEntityPricingId` | `GENEntityPricings` | `Id` | 15,634 | 647 |
| `Classroom_Session_Instructor` | `JobId` | `GENListValues` | `Id` | 15,634 | 3,328 |
| `Classroom_Session_Instructor` | `LanguageId` | `GENListValues` | `Id` | 15,634 | 3,328 |
| `Classroom_Session_Instructor` | `RegionId` | `GENRegions` | `Id` | 15,634 | 8 |
| `Classroom_Session_Instructor` | `UnitId` | `GENUnits` | `Id` | 15,634 | 1 |
| `Classroom_Session_Instructor` | `SessionId` | `TLMSClassroom_Session` | `Id` | 15,634 | 25,268 |
| `CompanyLogDatas` | `SourceId` | `CRMSources` | `Id` | 80 | 18 |
| `CompanyLogDatas` | `CurrencyId` | `GENCurrencies` | `Id` | 80 | 2 |
| `CompanyLogDatas` | `MainContactId` | `GENEmployees` | `Id` | 80 | 824 |
| `CompanyLogDatas` | `ValueId1` | `GENListValues` | `Id` | 80 | 3,328 |
| `CompanyLogDatas` | `ValueId2` | `GENListValues` | `Id` | 80 | 3,328 |
| `CompanyLogDatas` | `ValueId3` | `GENListValues` | `Id` | 80 | 3,328 |
| `CompanyLogDatas` | `ValueId4` | `GENListValues` | `Id` | 80 | 3,328 |
| `CompanyLogDatas` | `ValueId5` | `GENListValues` | `Id` | 80 | 3,328 |
| `CompanyLogDatas` | `StatusId` | `GENStatus` | `Id` | 80 | 9 |
| `CompanyLogDatas` | `IconId` | `GENStyles` | `Id` | 80 | 1,445 |
| `CompanyLogDatas` | `ImportLogId` | `ImportLogs` | `Id` | 80 | 668 |
| `ContactInfoes` | `ContactId` | `GENContacts` | `Id` | 15,078 | 51,607 |
| `ContactLogDatas` | `ValueId1` | `GENListValues` | `Id` | 6,141 | 3,328 |
| `ContactLogDatas` | `ValueId2` | `GENListValues` | `Id` | 6,141 | 3,328 |
| `ContactLogDatas` | `ValueId3` | `GENListValues` | `Id` | 6,141 | 3,328 |
| `ContactLogDatas` | `ValueId4` | `GENListValues` | `Id` | 6,141 | 3,328 |
| `ContactLogDatas` | `ValueId5` | `GENListValues` | `Id` | 6,141 | 3,328 |
| `ContactLogDatas` | `IconId` | `GENStyles` | `Id` | 6,141 | 1,445 |
| `ContactLogDatas` | `ImportLogId` | `ImportLogs` | `Id` | 6,141 | 668 |
| `Contacts_Courses` | `ClassRoomId` | `GENClassrooms` | `Id` | 44,931 | 2,996 |
| `Contacts_Courses` | `StudentId` | `GENContacts` | `Id` | 44,931 | 51,607 |
| `Contacts_Courses` | `OrderId` | `GENOrders` | `Id` | 44,931 | 3,701 |
| `Contacts_Courses` | `TalentId` | `GENTalents` | `Id` | 44,931 | 108 |
| `Contacts_Courses` | `CourseId` | `GENTypes` | `Id` | 44,931 | 416 |
| `CourseCategories` | `CategoryId` | `GENTypeCategories` | `Id` | 767 | 1,886 |
| `CourseCategories` | `CourseId` | `GENTypes` | `Id` | 767 | 416 |
| `Course_Question` | `QuestionId` | `GENPolls` | `Id` | 0 | 734 |
| `Course_Question` | `CourseId` | `GENTypes` | `Id` | 0 | 416 |
| `Course_Session` | `SessionId` | `GENItems` | `Id` | 4,041 | 5,180 |
| `Course_Session` | `CourseId` | `GENTypes` | `Id` | 4,041 | 416 |
| `DependencyTalentBuilders` | `DependencyTalentBuilderId` | `GENTalentBuilders` | `Id` | 0 | 40 |
| `DependencyTalentBuilders` | `MainTalentBuilderId` | `GENTalentBuilders` | `Id` | 0 | 40 |
| `Emogies` | `CreatedById` | `AspNetUsers` | `Id` | 6 | 40,910 |
| `Emogies` | `LastUpdatedById` | `AspNetUsers` | `Id` | 6 | 40,910 |
| `EmogyUserReplies` | `UserId` | `AspNetUsers` | `Id` | 0 | 40,910 |
| `EmogyUserReplies` | `BaseEntityId` | `BaseEntities` | `Id` | 0 | 203 |
| `EmogyUserReplies` | `EmogyId` | `Emogies` | `Id` | 0 | 6 |
| `EmogyUserReplies` | `CommentId` | `GENComments` | `Id` | 0 | 1 |
| `EmployeeEscalations` | `EmployeeId` | `GENEmployees` | `Id` | 0 | 824 |
| `GENActivateAccounts` | `BaseEntityId` | `BaseEntities` | `Id` | 25,332 | 203 |
| `GENAddressZones` | `DistrictId` | `GENDistricts` | `Id` | 0 | 9 |
| `GENAddressZones` | `ValueId1` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENAddressZones` | `ValueId2` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENAddressZones` | `ValueId3` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENAddressZones` | `ValueId4` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENAddressZones` | `ValueId5` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENAddressZones` | `IconId` | `GENStyles` | `Id` | 0 | 1,445 |
| `GENAddresses` | `BaseEntityId` | `BaseEntities` | `Id` | 38,548 | 203 |
| `GENAddresses` | `AddressZoneId` | `GENAddressZones` | `Id` | 38,548 | 0 |
| `GENAddresses` | `AreaId` | `GENAreas` | `Id` | 38,548 | 0 |
| `GENAddresses` | `CityId` | `GENCities` | `Id` | 38,548 | 28 |
| `GENAddresses` | `CountryId` | `GENCountries` | `Id` | 38,548 | 174 |
| `GENAddresses` | `DistrictId` | `GENDistricts` | `Id` | 38,548 | 9 |
| `GENAddresses` | `GovernorateId` | `GENGovernorates` | `Id` | 38,548 | 9 |
| `GENAddresses` | `AddressTypeId` | `GENListValues` | `Id` | 38,548 | 3,328 |
| `GENAddresses` | `ProvinceId` | `GENProvinces` | `Id` | 38,548 | 2 |
| `GENAddresses` | `RegionsId` | `GENRegions` | `Id` | 38,548 | 8 |
| `GENAreas` | `AddressZoneId` | `GENAddressZones` | `Id` | 0 | 0 |
| `GENAreas` | `ValueId1` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENAreas` | `ValueId2` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENAreas` | `ValueId3` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENAreas` | `ValueId4` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENAreas` | `ValueId5` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENAreas` | `IconId` | `GENStyles` | `Id` | 0 | 1,445 |
| `GENAudios` | `BaseEntityId` | `BaseEntities` | `Id` | 0 | 203 |
| `GENBackendPageSections` | `BackendPageSectionCategoryId` | `GENBackendPageSectionCategories` | `Id` | 54 | 6 |
| `GENBackendPageSections` | `StyleId` | `GENStyles` | `Id` | 54 | 1,445 |
| `GENBackendPages` | `BackendSectionId` | `GENBackendPageSections` | `Id` | 261 | 54 |
| `GENBackendPages` | `TextAlignId` | `GENListValues` | `Id` | 261 | 3,328 |
| `GENBackendPages` | `StyleId` | `GENStyles` | `Id` | 261 | 1,445 |
| `GENBackgroundImages` | `ValueId1` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENBackgroundImages` | `ValueId2` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENBackgroundImages` | `ValueId3` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENBackgroundImages` | `ValueId4` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENBackgroundImages` | `ValueId5` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENBackgroundImages` | `SectionId` | `GENSections` | `Id` | 0 | 2 |
| `GENBackgroundImages` | `IconId` | `GENStyles` | `Id` | 0 | 1,445 |
| `GENBackgroundImages` | `WikiId` | `GENWikis` | `Id` | 0 | 648 |
| `GENBlogs` | `CreatedById` | `AspNetUsers` | `Id` | 1 | 40,910 |
| `GENBlogs` | `DeletedById` | `AspNetUsers` | `Id` | 1 | 40,910 |
| `GENBlogs` | `LastUpdatedById` | `AspNetUsers` | `Id` | 1 | 40,910 |
| `GENBlogs` | `UserId` | `AspNetUsers` | `Id` | 1 | 40,910 |
| `GENBlogs` | `TalentId` | `GENTalents` | `Id` | 1 | 108 |
| `GENBlogs` | `CourseId` | `GENTypes` | `Id` | 1 | 416 |
| `GENBranchCategories` | `ValueId1` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENBranchCategories` | `ValueId2` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENBranchCategories` | `ValueId3` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENBranchCategories` | `ValueId4` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENBranchCategories` | `ValueId5` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENBranchCategories` | `IconId` | `GENStyles` | `Id` | 0 | 1,445 |
| `GENBranchHours` | `BranchId` | `GENBranches` | `Id` | 7 | 2 |
| `GENBranchTypes` | `ValueId1` | `GENListValues` | `Id` | 2 | 3,328 |
| `GENBranchTypes` | `ValueId2` | `GENListValues` | `Id` | 2 | 3,328 |
| `GENBranchTypes` | `ValueId3` | `GENListValues` | `Id` | 2 | 3,328 |
| `GENBranchTypes` | `ValueId4` | `GENListValues` | `Id` | 2 | 3,328 |
| `GENBranchTypes` | `ValueId5` | `GENListValues` | `Id` | 2 | 3,328 |
| `GENBranchTypes` | `IconId` | `GENStyles` | `Id` | 2 | 1,445 |
| `GENBranches` | `BaseEntityId` | `BaseEntities` | `Id` | 2 | 203 |
| `GENBranches` | `CRMSRVRequester_Id` | `CRMSRVRequesters` | `Id` | 2 | 0 |
| `GENBranches` | `BranchCategoryId` | `GENBranchCategories` | `Id` | 2 | 0 |
| `GENBranches` | `BranchTypeId` | `GENBranchTypes` | `Id` | 2 | 2 |
| `GENBranches` | `BrandId` | `GENBrands` | `Id` | 2 | 10 |
| `GENBranches` | `GENCompany_Id` | `GENCompanies` | `Id` | 2 | 6,045 |
| `GENBranches` | `ValueId1` | `GENListValues` | `Id` | 2 | 3,328 |
| `GENBranches` | `ValueId2` | `GENListValues` | `Id` | 2 | 3,328 |
| `GENBranches` | `ValueId3` | `GENListValues` | `Id` | 2 | 3,328 |
| `GENBranches` | `ValueId4` | `GENListValues` | `Id` | 2 | 3,328 |
| `GENBranches` | `ValueId5` | `GENListValues` | `Id` | 2 | 3,328 |
| `GENBranches` | `RegionId` | `GENRegions1` | `Id` | 2 | 0 |
| `GENBranches` | `IconId` | `GENStyles` | `Id` | 2 | 1,445 |
| `GENBrandCategories` | `ValueId1` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENBrandCategories` | `ValueId2` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENBrandCategories` | `ValueId3` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENBrandCategories` | `ValueId4` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENBrandCategories` | `ValueId5` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENBrandCategories` | `IconId` | `GENStyles` | `Id` | 0 | 1,445 |
| `GENBrands` | `BrandCategoryId` | `GENBrandCategories` | `Id` | 10 | 0 |
| `GENBrands` | `ValueId1` | `GENListValues` | `Id` | 10 | 3,328 |
| `GENBrands` | `ValueId2` | `GENListValues` | `Id` | 10 | 3,328 |
| `GENBrands` | `ValueId3` | `GENListValues` | `Id` | 10 | 3,328 |
| `GENBrands` | `ValueId4` | `GENListValues` | `Id` | 10 | 3,328 |
| `GENBrands` | `ValueId5` | `GENListValues` | `Id` | 10 | 3,328 |
| `GENBrands` | `IconId` | `GENStyles` | `Id` | 10 | 1,445 |
| `GENBulkEmails` | `NewsLetterEmailId` | `GENNewsLetterEmails` | `Id` | 0 | 0 |
| `GENBulkEmailsArchives` | `BulkEmailId` | `GENBulkEmails` | `Id` | 0 | 0 |
| `GENBulkPushNotifications` | `BaseEntityId` | `BaseEntities` | `Id` | 0 | 203 |
| `GENBulkPushNotifications` | `LangId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENBulkPushNotifications` | `ValueId1` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENBulkPushNotifications` | `ValueId2` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENBulkPushNotifications` | `ValueId3` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENBulkPushNotifications` | `ValueId4` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENBulkPushNotifications` | `ValueId5` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENBulkPushNotifications` | `IconId` | `GENStyles` | `Id` | 0 | 1,445 |
| `GENBulkRequest_LOGStop` | `BulkRequestId` | `GENBulkRequests` | `Id` | 0 | 0 |
| `GENBulkRequest_LOGStop` | `StatusId` | `GENStatus` | `Id` | 0 | 9 |
| `GENBulkRequest_LOGStop` | `StopId` | `LOGStops` | `Id` | 0 | 0 |
| `GENBulkRequests` | `CreatedById` | `AspNetUsers` | `Id` | 0 | 40,910 |
| `GENBulkRequests` | `DeletedById` | `AspNetUsers` | `Id` | 0 | 40,910 |
| `GENBulkRequests` | `LastUpdatedById` | `AspNetUsers` | `Id` | 0 | 40,910 |
| `GENBulkRequests` | `UserId` | `AspNetUsers` | `Id` | 0 | 40,910 |
| `GENBulkRequests` | `RequesterId` | `CRMSRVRequesters` | `Id` | 0 | 0 |
| `GENBulkRequests` | `CompanyId` | `GENCompanies` | `Id` | 0 | 6,045 |
| `GENBulkRequests` | `PaymentMethodId` | `GENPaymentMethods` | `Id` | 0 | 7 |
| `GENBulkRequests` | `RequestTypeId` | `GENRequestTypes` | `Id` | 0 | 0 |
| `GENBulkRequests` | `GENStatusId` | `GENStatus` | `Id` | 0 | 9 |
| `GENBulkRequests` | `IconId` | `GENStyles` | `Id` | 0 | 1,445 |
| `GENBulkRequests` | `VehicleId` | `GENVehicles` | `Id` | 0 | 0 |
| `GENBulkRequests` | `RouteId` | `LOGRoutes` | `Id` | 0 | 0 |
| `GENBulkRequests` | `StopId` | `LOGStops` | `Id` | 0 | 0 |
| `GENCertificates` | `ContactId` | `GENContacts` | `Id` | 46,086 | 51,607 |
| `GENCertificates` | `TemplateId` | `GENWikis` | `Id` | 46,086 | 648 |
| `GENCertificationFrames` | `CreatedById` | `AspNetUsers` | `Id` | 2 | 40,910 |
| `GENCertificationFrames` | `LastUpdatedById` | `AspNetUsers` | `Id` | 2 | 40,910 |
| `GENCertificationFrames` | `BaseEntityId` | `BaseEntities` | `Id` | 2 | 203 |
| `GENCertificationFrames` | `EmployeeId` | `GENEmployees` | `Id` | 2 | 824 |
| `GENCertificationFrames` | `LangId` | `GENListValues` | `Id` | 2 | 3,328 |
| `GENCertification_Requests` | `ClassroomId` | `GENClassrooms` | `Id` | 0 | 2,996 |
| `GENCertification_Requests` | `StudentId` | `GENContacts` | `Id` | 0 | 51,607 |
| `GENCertification_Requests` | `CourseId` | `GENTypes` | `Id` | 0 | 416 |
| `GENCertifications` | `CreatedById` | `AspNetUsers` | `Id` | 2 | 40,910 |
| `GENCertifications` | `LastUpdatedById` | `AspNetUsers` | `Id` | 2 | 40,910 |
| `GENCertifications` | `BaseEntityId` | `BaseEntities` | `Id` | 2 | 203 |
| `GENCertifications` | `EmployeeId` | `GENEmployees` | `Id` | 2 | 824 |
| `GENChatGroupMessages` | `UserReceiverId` | `AspNetUsers` | `Id` | 66 | 40,910 |
| `GENChatGroupMessages` | `ChatMessageId` | `GENChatMessages` | `Id` | 66 | 373 |
| `GENChatGroupUsers` | `UserId` | `AspNetUsers` | `Id` | 39 | 40,910 |
| `GENChatGroupUsers` | `BaseEntityId` | `BaseEntities` | `Id` | 39 | 203 |
| `GENChatGroupUsers` | `ChatGroupId` | `GENChatGroups` | `Id` | 39 | 8 |
| `GENChatMessages` | `UserReceiverId` | `AspNetUsers` | `Id` | 373 | 40,910 |
| `GENChatMessages` | `UserSenderId` | `AspNetUsers` | `Id` | 373 | 40,910 |
| `GENChatMessages` | `ChatGroupId` | `GENChatGroups` | `Id` | 373 | 8 |
| `GENChatMessages` | `OriginalMessageId` | `GENChatMessages` | `Id` | 373 | 373 |
| `GENChatMessages` | `ChatEntityPoPId` | `GENPageOfPages` | `Id` | 373 | 348 |
| `GENChatPairConnections` | `RecieverId` | `AspNetUsers` | `Id` | 93 | 40,910 |
| `GENChatPairConnections` | `SenderId` | `AspNetUsers` | `Id` | 93 | 40,910 |
| `GENChatStatus` | `MainStatusId` | `GENStatus` | `Id` | 29,647 | 9 |
| `GENCities` | `CityCategoryId` | `GENCityCategories` | `Id` | 28 | 0 |
| `GENCities` | `GovernorateId` | `GENGovernorates` | `Id` | 28 | 9 |
| `GENCities` | `ValueId1` | `GENListValues` | `Id` | 28 | 3,328 |
| `GENCities` | `ValueId2` | `GENListValues` | `Id` | 28 | 3,328 |
| `GENCities` | `ValueId3` | `GENListValues` | `Id` | 28 | 3,328 |
| `GENCities` | `ValueId4` | `GENListValues` | `Id` | 28 | 3,328 |
| `GENCities` | `ValueId5` | `GENListValues` | `Id` | 28 | 3,328 |
| `GENCities` | `IconId` | `GENStyles` | `Id` | 28 | 1,445 |
| `GENCityCategories` | `ValueId1` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENCityCategories` | `ValueId2` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENCityCategories` | `ValueId3` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENCityCategories` | `ValueId4` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENCityCategories` | `ValueId5` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENCityCategories` | `IconId` | `GENStyles` | `Id` | 0 | 1,445 |
| `GENClassificationCategories` | `ValueId1` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENClassificationCategories` | `ValueId2` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENClassificationCategories` | `ValueId3` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENClassificationCategories` | `ValueId4` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENClassificationCategories` | `ValueId5` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENClassificationCategories` | `IconId` | `GENStyles` | `Id` | 0 | 1,445 |
| `GENClassifications` | `ClassificationCategoryId` | `GENClassificationCategories` | `Id` | 2 | 0 |
| `GENClassifications` | `ValueId1` | `GENListValues` | `Id` | 2 | 3,328 |
| `GENClassifications` | `ValueId2` | `GENListValues` | `Id` | 2 | 3,328 |
| `GENClassifications` | `ValueId3` | `GENListValues` | `Id` | 2 | 3,328 |
| `GENClassifications` | `ValueId4` | `GENListValues` | `Id` | 2 | 3,328 |
| `GENClassifications` | `ValueId5` | `GENListValues` | `Id` | 2 | 3,328 |
| `GENClassifications` | `IconId` | `GENStyles` | `Id` | 2 | 1,445 |
| `GENClassroomCategories` | `ValueId1` | `GENListValues` | `Id` | 3 | 3,328 |
| `GENClassroomCategories` | `ValueId2` | `GENListValues` | `Id` | 3 | 3,328 |
| `GENClassroomCategories` | `ValueId3` | `GENListValues` | `Id` | 3 | 3,328 |
| `GENClassroomCategories` | `ValueId4` | `GENListValues` | `Id` | 3 | 3,328 |
| `GENClassroomCategories` | `ValueId5` | `GENListValues` | `Id` | 3 | 3,328 |
| `GENClassroomCategories` | `IconId` | `GENStyles` | `Id` | 3 | 1,445 |
| `GENClassroom_GENContact` | `ClassroomId` | `GENClassrooms` | `Id` | 63,951 | 2,996 |
| `GENClassroom_GENContact` | `StudentId` | `GENContacts` | `Id` | 63,951 | 51,607 |
| `GENClassroom_GENContact` | `VoucherId` | `GENDiscountCards` | `Id` | 63,951 | 5 |
| `GENClassrooms` | `DeletedById` | `AspNetUsers` | `Id` | 2,996 | 40,910 |
| `GENClassrooms` | `CityId` | `GENCities` | `Id` | 2,996 | 28 |
| `GENClassrooms` | `ClassroomCategoryId` | `GENClassroomCategories` | `Id` | 2,996 | 3 |
| `GENClassrooms` | `CompanyId` | `GENCompanies` | `Id` | 2,996 | 6,045 |
| `GENClassrooms` | `DestinationsId` | `GENCompanies` | `Id` | 2,996 | 6,045 |
| `GENClassrooms` | `OrganizationId` | `GENCompanies` | `Id` | 2,996 | 6,045 |
| `GENClassrooms` | `CountryId` | `GENCountries` | `Id` | 2,996 | 174 |
| `GENClassrooms` | `CurrencyId` | `GENCurrencies` | `Id` | 2,996 | 2 |
| `GENClassrooms` | `InstructorId` | `GENEmployees` | `Id` | 2,996 | 824 |
| `GENClassrooms` | `GovernorateId` | `GENGovernorates` | `Id` | 2,996 | 9 |
| `GENClassrooms` | `EventTypeId` | `GENListValues` | `Id` | 2,996 | 3,328 |
| `GENClassrooms` | `LanguageId` | `GENListValues` | `Id` | 2,996 | 3,328 |
| `GENClassrooms` | `ValueId1` | `GENListValues` | `Id` | 2,996 | 3,328 |
| `GENClassrooms` | `ValueId2` | `GENListValues` | `Id` | 2,996 | 3,328 |
| `GENClassrooms` | `ValueId3` | `GENListValues` | `Id` | 2,996 | 3,328 |
| `GENClassrooms` | `ValueId4` | `GENListValues` | `Id` | 2,996 | 3,328 |
| `GENClassrooms` | `ValueId5` | `GENListValues` | `Id` | 2,996 | 3,328 |
| `GENClassrooms` | `ExamId` | `GENPollCategories` | `Id` | 2,996 | 65 |
| `GENClassrooms` | `RoomId` | `GENRooms` | `Id` | 2,996 | 47 |
| `GENClassrooms` | `IconId` | `GENStyles` | `Id` | 2,996 | 1,445 |
| `GENClassrooms` | `CourseId` | `GENTypes` | `Id` | 2,996 | 416 |
| `GENClassrooms` | `WikiId` | `GENWikis` | `Id` | 2,996 | 648 |
| `GENCommentTypes` | `ValueId1` | `GENListValues` | `Id` | 7 | 3,328 |
| `GENCommentTypes` | `ValueId2` | `GENListValues` | `Id` | 7 | 3,328 |
| `GENCommentTypes` | `ValueId3` | `GENListValues` | `Id` | 7 | 3,328 |
| `GENCommentTypes` | `ValueId4` | `GENListValues` | `Id` | 7 | 3,328 |
| `GENCommentTypes` | `ValueId5` | `GENListValues` | `Id` | 7 | 3,328 |
| `GENComments` | `CreatedById` | `AspNetUsers` | `Id` | 1 | 40,910 |
| `GENComments` | `DeletedById` | `AspNetUsers` | `Id` | 1 | 40,910 |
| `GENComments` | `LastUpdatedById` | `AspNetUsers` | `Id` | 1 | 40,910 |
| `GENComments` | `UserId` | `AspNetUsers` | `Id` | 1 | 40,910 |
| `GENComments` | `BlogId` | `GENBlogs` | `Id` | 1 | 1 |
| `GENComments` | `ParentId` | `GENComments` | `Id` | 1 | 1 |
| `GENCompanies` | `SourceId` | `CRMSources` | `Id` | 6,045 | 18 |
| `GENCompanies` | `CompanyTypeId` | `GENCompanyTypes` | `Id` | 6,045 | 11 |
| `GENCompanies` | `CurrencyId` | `GENCurrencies` | `Id` | 6,045 | 2 |
| `GENCompanies` | `LastDiscountById` | `GENEmployees` | `Id` | 6,045 | 824 |
| `GENCompanies` | `MainContactId` | `GENEmployees` | `Id` | 6,045 | 824 |
| `GENCompanies` | `IndustryId` | `GENIndustries` | `Id` | 6,045 | 25 |
| `GENCompanies` | `ValueId1` | `GENListValues` | `Id` | 6,045 | 3,328 |
| `GENCompanies` | `ValueId2` | `GENListValues` | `Id` | 6,045 | 3,328 |
| `GENCompanies` | `ValueId3` | `GENListValues` | `Id` | 6,045 | 3,328 |
| `GENCompanies` | `ValueId4` | `GENListValues` | `Id` | 6,045 | 3,328 |
| `GENCompanies` | `ValueId5` | `GENListValues` | `Id` | 6,045 | 3,328 |
| `GENCompanies` | `PaymentMethodId` | `GENPaymentMethods` | `Id` | 6,045 | 7 |
| `GENCompanies` | `StatusId` | `GENStatus` | `Id` | 6,045 | 9 |
| `GENCompanies` | `IconId` | `GENStyles` | `Id` | 6,045 | 1,445 |
| `GENCompaniesRatings` | `CompaniesId` | `GENCompanies` | `Id` | 0 | 6,045 |
| `GENCompanyAddresses` | `CityId` | `GENCities` | `Id` | 0 | 28 |
| `GENCompanyAddresses` | `CompanyId` | `GENCompanies` | `Id` | 0 | 6,045 |
| `GENCompanyAddresses` | `CountryId` | `GENCountries` | `Id` | 0 | 174 |
| `GENCompanyAddresses` | `RegionId` | `GENRegions1` | `Id` | 0 | 0 |
| `GENCompanyComments` | `CompanyId` | `GENCompanies` | `Id` | 0 | 6,045 |
| `GENCompanyEmails` | `CompanyId` | `GENCompanies` | `Id` | 13 | 6,045 |
| `GENCompanyPhones` | `CompanyId` | `GENCompanies` | `Id` | 13 | 6,045 |
| `GENCompanyTypes` | `ParentId` | `GENCompanyTypes` | `Id` | 11 | 11 |
| `GENCompanyTypes` | `ValueId1` | `GENListValues` | `Id` | 11 | 3,328 |
| `GENCompanyTypes` | `ValueId2` | `GENListValues` | `Id` | 11 | 3,328 |
| `GENCompanyTypes` | `ValueId3` | `GENListValues` | `Id` | 11 | 3,328 |
| `GENCompanyTypes` | `ValueId4` | `GENListValues` | `Id` | 11 | 3,328 |
| `GENCompanyTypes` | `ValueId5` | `GENListValues` | `Id` | 11 | 3,328 |
| `GENCompanyTypes` | `IconId` | `GENStyles` | `Id` | 11 | 1,445 |
| `GENCompetitionCategories` | `ValueId1` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENCompetitionCategories` | `ValueId2` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENCompetitionCategories` | `ValueId3` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENCompetitionCategories` | `ValueId4` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENCompetitionCategories` | `ValueId5` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENCompetitionCategories` | `IconId` | `GENStyles` | `Id` | 0 | 1,445 |
| `GENCompetitionUserItems` | `UserId` | `AspNetUsers` | `Id` | 0 | 40,910 |
| `GENCompetitionUserItems` | `CompetitionId` | `GENCompetitions` | `Id` | 0 | 0 |
| `GENCompetitionUserItems` | `ItemId` | `GENItemCompetitions` | `Id` | 0 | 0 |
| `GENCompetitions` | `BrandId` | `GENBrands` | `Id` | 0 | 10 |
| `GENCompetitions` | `CompetitionCategoryId` | `GENCompetitionCategories` | `Id` | 0 | 0 |
| `GENCompetitions` | `ItemCategoryId` | `GENItemCategories` | `Id` | 0 | 3 |
| `GENCompetitions` | `ValueId1` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENCompetitions` | `ValueId2` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENCompetitions` | `ValueId3` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENCompetitions` | `ValueId4` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENCompetitions` | `ValueId5` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENCompetitions` | `IconId` | `GENStyles` | `Id` | 0 | 1,445 |
| `GENConfigurationCategories` | `ValueId1` | `GENListValues` | `Id` | 5 | 3,328 |
| `GENConfigurationCategories` | `ValueId2` | `GENListValues` | `Id` | 5 | 3,328 |
| `GENConfigurationCategories` | `ValueId3` | `GENListValues` | `Id` | 5 | 3,328 |
| `GENConfigurationCategories` | `ValueId4` | `GENListValues` | `Id` | 5 | 3,328 |
| `GENConfigurationCategories` | `ValueId5` | `GENListValues` | `Id` | 5 | 3,328 |
| `GENConfigurationCategories` | `IconId` | `GENStyles` | `Id` | 5 | 1,445 |
| `GENConfigurations` | `ConfigurationCategoryId` | `GENConfigurationCategories` | `Id` | 174 | 5 |
| `GENConfigurations` | `ValueId1` | `GENListValues` | `Id` | 174 | 3,328 |
| `GENConfigurations` | `ValueId2` | `GENListValues` | `Id` | 174 | 3,328 |
| `GENConfigurations` | `ValueId3` | `GENListValues` | `Id` | 174 | 3,328 |
| `GENConfigurations` | `ValueId4` | `GENListValues` | `Id` | 174 | 3,328 |
| `GENConfigurations` | `ValueId5` | `GENListValues` | `Id` | 174 | 3,328 |
| `GENContactAddresses` | `CityId` | `GENCities` | `Id` | 0 | 28 |
| `GENContactAddresses` | `ContactId` | `GENContacts` | `Id` | 0 | 51,607 |
| `GENContactAddresses` | `CountryId` | `GENCountries` | `Id` | 0 | 174 |
| `GENContactAddresses` | `RegionId` | `GENRegions1` | `Id` | 0 | 0 |
| `GENContactCategories` | `ValueId1` | `GENListValues` | `Id` | 3 | 3,328 |
| `GENContactCategories` | `ValueId2` | `GENListValues` | `Id` | 3 | 3,328 |
| `GENContactCategories` | `ValueId3` | `GENListValues` | `Id` | 3 | 3,328 |
| `GENContactCategories` | `ValueId4` | `GENListValues` | `Id` | 3 | 3,328 |
| `GENContactCategories` | `ValueId5` | `GENListValues` | `Id` | 3 | 3,328 |
| `GENContactCategories` | `IconId` | `GENStyles` | `Id` | 3 | 1,445 |
| `GENContactComments` | `ContactId` | `GENContacts` | `Id` | 0 | 51,607 |
| `GENContactEmails` | `ContactId` | `GENContacts` | `Id` | 15,775 | 51,607 |
| `GENContactPhones` | `ContactTypeId` | `GENContactTypes` | `Id` | 14,755 | 4 |
| `GENContactPhones` | `ContactId` | `GENContacts` | `Id` | 14,755 | 51,607 |
| `GENContactProgressCompletionDetails` | `BaseEntityId` | `BaseEntities` | `Id` | 6,366 | 203 |
| `GENContactProgressCompletionDetails` | `ContactProgressCompletionId` | `GENContactProgressCompletions` | `Id` | 6,366 | 8,073 |
| `GENContactProgressCompletions` | `BaseEntityId` | `BaseEntities` | `Id` | 8,073 | 203 |
| `GENContactProgressCompletions` | `ClassroomId` | `GENClassrooms` | `Id` | 8,073 | 2,996 |
| `GENContactProgressCompletions` | `ContactId` | `GENContacts` | `Id` | 8,073 | 51,607 |
| `GENContactProgressCompletions` | `CourseId` | `GENTypes` | `Id` | 8,073 | 416 |
| `GENContactTypes` | `ValueId1` | `GENListValues` | `Id` | 4 | 3,328 |
| `GENContactTypes` | `ValueId2` | `GENListValues` | `Id` | 4 | 3,328 |
| `GENContactTypes` | `ValueId3` | `GENListValues` | `Id` | 4 | 3,328 |
| `GENContactTypes` | `ValueId4` | `GENListValues` | `Id` | 4 | 3,328 |
| `GENContactTypes` | `ValueId5` | `GENListValues` | `Id` | 4 | 3,328 |
| `GENContact_Generic` | `BaseEntityId` | `BaseEntities` | `Id` | 0 | 203 |
| `GENContact_Generic` | `ContactId` | `GENContacts` | `Id` | 0 | 51,607 |
| `GENContact_Generic` | `RelativeRelationId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENContact_News` | `ContactId` | `GENContacts` | `Id` | 0 | 51,607 |
| `GENContact_News` | `NewsId` | `GENNews` | `Id` | 0 | 5 |
| `GENContact_Talent` | `ContactId` | `GENContacts` | `Id` | 648 | 51,607 |
| `GENContact_Talent` | `VoucherId` | `GENDiscountCards` | `Id` | 648 | 5 |
| `GENContact_Talent` | `TalentId` | `GENTalents` | `Id` | 648 | 108 |
| `GENContacts` | `DeletedById` | `AspNetUsers` | `Id` | 51,607 | 40,910 |
| `GENContacts` | `UserId` | `AspNetUsers` | `Id` | 51,607 | 40,910 |
| `GENContacts` | `BaseEntityId` | `BaseEntities` | `Id` | 51,607 | 203 |
| `GENContacts` | `ReasonId` | `CRMSRVReasons` | `Id` | 51,607 | 0 |
| `GENContacts` | `SourceId` | `CRMSources` | `Id` | 51,607 | 18 |
| `GENContacts` | `CRMTicket_Id` | `CRMTickets` | `Id` | 51,607 | 0 |
| `GENContacts` | `CompanyId` | `GENCompanies` | `Id` | 51,607 | 6,045 |
| `GENContacts` | `OfficialOrganizationId` | `GENCompanies` | `Id` | 51,607 | 6,045 |
| `GENContacts` | `ContactCategoryId` | `GENContactCategories` | `Id` | 51,607 | 3 |
| `GENContacts` | `ContactTypeId` | `GENContactTypes` | `Id` | 51,607 | 4 |
| `GENContacts` | `ReferralId` | `GENContacts` | `Id` | 51,607 | 51,607 |
| `GENContacts` | `DepartmentId` | `GENDepartments` | `Id` | 51,607 | 6 |
| `GENContacts` | `GovernorateId` | `GENGovernorates` | `Id` | 51,607 | 9 |
| `GENContacts` | `AssessmentId` | `GENListValues` | `Id` | 51,607 | 3,328 |
| `GENContacts` | `BirthplaceId` | `GENListValues` | `Id` | 51,607 | 3,328 |
| `GENContacts` | `ClubId` | `GENListValues` | `Id` | 51,607 | 3,328 |
| `GENContacts` | `EmployerId` | `GENListValues` | `Id` | 51,607 | 3,328 |
| `GENContacts` | `GenderId` | `GENListValues` | `Id` | 51,607 | 3,328 |
| `GENContacts` | `IDNumberCheckId` | `GENListValues` | `Id` | 51,607 | 3,328 |
| `GENContacts` | `JobId` | `GENListValues` | `Id` | 51,607 | 3,328 |
| `GENContacts` | `LanguageId` | `GENListValues` | `Id` | 51,607 | 3,328 |
| `GENContacts` | `MartialStatusId` | `GENListValues` | `Id` | 51,607 | 3,328 |
| `GENContacts` | `NationalityId` | `GENListValues` | `Id` | 51,607 | 3,328 |
| `GENContacts` | `PositionRecruitmentId` | `GENListValues` | `Id` | 51,607 | 3,328 |
| `GENContacts` | `PriortyId` | `GENListValues` | `Id` | 51,607 | 3,328 |
| `GENContacts` | `QualificationId` | `GENListValues` | `Id` | 51,607 | 3,328 |
| `GENContacts` | `RelativeRelationId` | `GENListValues` | `Id` | 51,607 | 3,328 |
| `GENContacts` | `ReligionId` | `GENListValues` | `Id` | 51,607 | 3,328 |
| `GENContacts` | `RentPeriodId` | `GENListValues` | `Id` | 51,607 | 3,328 |
| `GENContacts` | `SocialStatusId` | `GENListValues` | `Id` | 51,607 | 3,328 |
| `GENContacts` | `TypeofPersonalizationId` | `GENListValues` | `Id` | 51,607 | 3,328 |
| `GENContacts` | `ValueId1` | `GENListValues` | `Id` | 51,607 | 3,328 |
| `GENContacts` | `ValueId2` | `GENListValues` | `Id` | 51,607 | 3,328 |
| `GENContacts` | `ValueId3` | `GENListValues` | `Id` | 51,607 | 3,328 |
| `GENContacts` | `ValueId4` | `GENListValues` | `Id` | 51,607 | 3,328 |
| `GENContacts` | `ValueId5` | `GENListValues` | `Id` | 51,607 | 3,328 |
| `GENContacts` | `PageOfPageId` | `GENPageOfPages` | `Id` | 51,607 | 348 |
| `GENContacts` | `PaymentMethodId` | `GENPaymentMethods` | `Id` | 51,607 | 7 |
| `GENContacts` | `SalutationId` | `GENSalutations` | `Id` | 51,607 | 19 |
| `GENContacts` | `StatusId` | `GENStatus` | `Id` | 51,607 | 9 |
| `GENContacts` | `IconId` | `GENStyles` | `Id` | 51,607 | 1,445 |
| `GENContacts` | `TypeId` | `GENTypes` | `Id` | 51,607 | 416 |
| `GENCountries` | `CountryCategoryId` | `GENCountryCategories` | `Id` | 174 | 0 |
| `GENCountries` | `ValueId1` | `GENListValues` | `Id` | 174 | 3,328 |
| `GENCountries` | `ValueId2` | `GENListValues` | `Id` | 174 | 3,328 |
| `GENCountries` | `ValueId3` | `GENListValues` | `Id` | 174 | 3,328 |
| `GENCountries` | `ValueId4` | `GENListValues` | `Id` | 174 | 3,328 |
| `GENCountries` | `ValueId5` | `GENListValues` | `Id` | 174 | 3,328 |
| `GENCountries` | `RegionsId` | `GENRegions` | `Id` | 174 | 8 |
| `GENCountries` | `IconId` | `GENStyles` | `Id` | 174 | 1,445 |
| `GENCountryCategories` | `ValueId1` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENCountryCategories` | `ValueId2` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENCountryCategories` | `ValueId3` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENCountryCategories` | `ValueId4` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENCountryCategories` | `ValueId5` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENCountryCategories` | `IconId` | `GENStyles` | `Id` | 0 | 1,445 |
| `GENCurrencies` | `CurrencyCategoryId` | `GENCurrencyCategories` | `Id` | 2 | 0 |
| `GENCurrencies` | `ValueId1` | `GENListValues` | `Id` | 2 | 3,328 |
| `GENCurrencies` | `ValueId2` | `GENListValues` | `Id` | 2 | 3,328 |
| `GENCurrencies` | `ValueId3` | `GENListValues` | `Id` | 2 | 3,328 |
| `GENCurrencies` | `ValueId4` | `GENListValues` | `Id` | 2 | 3,328 |
| `GENCurrencies` | `ValueId5` | `GENListValues` | `Id` | 2 | 3,328 |
| `GENCurrencies` | `IconId` | `GENStyles` | `Id` | 2 | 1,445 |
| `GENCurrencyCategories` | `ValueId1` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENCurrencyCategories` | `ValueId2` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENCurrencyCategories` | `ValueId3` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENCurrencyCategories` | `ValueId4` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENCurrencyCategories` | `ValueId5` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENCurrencyCategories` | `IconId` | `GENStyles` | `Id` | 0 | 1,445 |
| `GENDashboardWidgetProperties` | `GENDashboardWidgetId` | `GENDashboardWidgets` | `Id` | 0 | 0 |
| `GENDashboardWidgets` | `BaseEntityId` | `BaseEntities` | `Id` | 0 | 203 |
| `GENDashboardWidgets` | `DisplayId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENDashboardWidgets` | `SizeId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENDashboardWidgets` | `TypeId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENDepartmentCategories` | `ValueId1` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENDepartmentCategories` | `ValueId2` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENDepartmentCategories` | `ValueId3` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENDepartmentCategories` | `ValueId4` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENDepartmentCategories` | `ValueId5` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENDepartmentCategories` | `IconId` | `GENStyles` | `Id` | 0 | 1,445 |
| `GENDepartments` | `GENCompanyId` | `GENCompanies` | `Id` | 6 | 6,045 |
| `GENDepartments` | `DepartmentCategoryId` | `GENDepartmentCategories` | `Id` | 6 | 0 |
| `GENDepartments` | `ValueId1` | `GENListValues` | `Id` | 6 | 3,328 |
| `GENDepartments` | `ValueId2` | `GENListValues` | `Id` | 6 | 3,328 |
| `GENDepartments` | `ValueId3` | `GENListValues` | `Id` | 6 | 3,328 |
| `GENDepartments` | `ValueId4` | `GENListValues` | `Id` | 6 | 3,328 |
| `GENDepartments` | `ValueId5` | `GENListValues` | `Id` | 6 | 3,328 |
| `GENDepartments` | `IconId` | `GENStyles` | `Id` | 6 | 1,445 |
| `GENDiscountCategories` | `ValueId1` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENDiscountCategories` | `ValueId2` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENDiscountCategories` | `ValueId3` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENDiscountCategories` | `ValueId4` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENDiscountCategories` | `ValueId5` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENDiscountCategories` | `IconId` | `GENStyles` | `Id` | 0 | 1,445 |
| `GENDiscounts` | `DiscountCategoryId` | `GENDiscountCategories` | `Id` | 0 | 0 |
| `GENDiscounts` | `ValueId1` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENDiscounts` | `ValueId2` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENDiscounts` | `ValueId3` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENDiscounts` | `ValueId4` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENDiscounts` | `ValueId5` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENDiscounts` | `IconId` | `GENStyles` | `Id` | 0 | 1,445 |
| `GENDistricts` | `CityId` | `GENCities` | `Id` | 9 | 28 |
| `GENDistricts` | `ValueId1` | `GENListValues` | `Id` | 9 | 3,328 |
| `GENDistricts` | `ValueId2` | `GENListValues` | `Id` | 9 | 3,328 |
| `GENDistricts` | `ValueId3` | `GENListValues` | `Id` | 9 | 3,328 |
| `GENDistricts` | `ValueId4` | `GENListValues` | `Id` | 9 | 3,328 |
| `GENDistricts` | `ValueId5` | `GENListValues` | `Id` | 9 | 3,328 |
| `GENDistricts` | `IconId` | `GENStyles` | `Id` | 9 | 1,445 |
| `GENDriverRatings` | `UserId` | `AspNetUsers` | `Id` | 0 | 40,910 |
| `GENDualLinkAttachments` | `FileTypeId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENDualLinkAttachments` | `LanguageId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENEasyAccesses` | `BackEndPageId` | `GENBackendPages` | `Id` | 57 | 261 |
| `GENEasyAccesses` | `ValueId1` | `GENListValues` | `Id` | 57 | 3,328 |
| `GENEasyAccesses` | `ValueId2` | `GENListValues` | `Id` | 57 | 3,328 |
| `GENEasyAccesses` | `ValueId3` | `GENListValues` | `Id` | 57 | 3,328 |
| `GENEasyAccesses` | `ValueId4` | `GENListValues` | `Id` | 57 | 3,328 |
| `GENEasyAccesses` | `ValueId5` | `GENListValues` | `Id` | 57 | 3,328 |
| `GENEasyAccesses` | `PopId` | `GENPageOfPages` | `Id` | 57 | 348 |
| `GENEmailTypes` | `ValueId1` | `GENListValues` | `Id` | 1 | 3,328 |
| `GENEmailTypes` | `ValueId2` | `GENListValues` | `Id` | 1 | 3,328 |
| `GENEmailTypes` | `ValueId3` | `GENListValues` | `Id` | 1 | 3,328 |
| `GENEmailTypes` | `ValueId4` | `GENListValues` | `Id` | 1 | 3,328 |
| `GENEmailTypes` | `ValueId5` | `GENListValues` | `Id` | 1 | 3,328 |
| `GENEmailTypes` | `IconId` | `GENStyles` | `Id` | 1 | 1,445 |
| `GENEmails` | `BaseEntityId` | `BaseEntities` | `Id` | 268 | 203 |
| `GENEmails` | `EmailTypeId` | `GENEmailTypes` | `Id` | 268 | 1 |
| `GENEmployeeCategories` | `ValueId1` | `GENListValues` | `Id` | 2 | 3,328 |
| `GENEmployeeCategories` | `ValueId2` | `GENListValues` | `Id` | 2 | 3,328 |
| `GENEmployeeCategories` | `ValueId3` | `GENListValues` | `Id` | 2 | 3,328 |
| `GENEmployeeCategories` | `ValueId4` | `GENListValues` | `Id` | 2 | 3,328 |
| `GENEmployeeCategories` | `ValueId5` | `GENListValues` | `Id` | 2 | 3,328 |
| `GENEmployeeCategories` | `IconId` | `GENStyles` | `Id` | 2 | 1,445 |
| `GENEmployeeRatings` | `EmployeeId` | `GENEmployees` | `Id` | 0 | 824 |
| `GENEmployeeRatings` | `ValueId1` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENEmployeeRatings` | `ValueId2` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENEmployeeRatings` | `ValueId3` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENEmployeeRatings` | `ValueId4` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENEmployeeRatings` | `ValueId5` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENEmployeeRatings` | `IconId` | `GENStyles` | `Id` | 0 | 1,445 |
| `GENEmployeeTypes` | `ValueId1` | `GENListValues` | `Id` | 2 | 3,328 |
| `GENEmployeeTypes` | `ValueId2` | `GENListValues` | `Id` | 2 | 3,328 |
| `GENEmployeeTypes` | `ValueId3` | `GENListValues` | `Id` | 2 | 3,328 |
| `GENEmployeeTypes` | `ValueId4` | `GENListValues` | `Id` | 2 | 3,328 |
| `GENEmployeeTypes` | `ValueId5` | `GENListValues` | `Id` | 2 | 3,328 |
| `GENEmployeeTypes` | `IconId` | `GENStyles` | `Id` | 2 | 1,445 |
| `GENEmployees` | `DeletedById` | `AspNetUsers` | `Id` | 824 | 40,910 |
| `GENEmployees` | `UserId` | `AspNetUsers` | `Id` | 824 | 40,910 |
| `GENEmployees` | `CRMSRVRequester_Id` | `CRMSRVRequesters` | `Id` | 824 | 0 |
| `GENEmployees` | `BaseBranchId` | `GENBranches` | `Id` | 824 | 2 |
| `GENEmployees` | `ClassificationId` | `GENClassifications` | `Id` | 824 | 2 |
| `GENEmployees` | `GENCompany_Id` | `GENCompanies` | `Id` | 824 | 6,045 |
| `GENEmployees` | `ContactId` | `GENContacts` | `Id` | 824 | 51,607 |
| `GENEmployees` | `DepartmentId` | `GENDepartments` | `Id` | 824 | 6 |
| `GENEmployees` | `EmployeeCategoryId` | `GENEmployeeCategories` | `Id` | 824 | 2 |
| `GENEmployees` | `EmployeeTypeId` | `GENEmployeeTypes` | `Id` | 824 | 2 |
| `GENEmployees` | `EmployeeId` | `GENEmployees` | `Id` | 824 | 824 |
| `GENEmployees` | `GenderId` | `GENListValues` | `Id` | 824 | 3,328 |
| `GENEmployees` | `JobCategoryId` | `GENListValues` | `Id` | 824 | 3,328 |
| `GENEmployees` | `Language1Id` | `GENListValues` | `Id` | 824 | 3,328 |
| `GENEmployees` | `Language2Id` | `GENListValues` | `Id` | 824 | 3,328 |
| `GENEmployees` | `MartialStatusId` | `GENListValues` | `Id` | 824 | 3,328 |
| `GENEmployees` | `MilitaryStatusId` | `GENListValues` | `Id` | 824 | 3,328 |
| `GENEmployees` | `QualificationId` | `GENListValues` | `Id` | 824 | 3,328 |
| `GENEmployees` | `ValueId1` | `GENListValues` | `Id` | 824 | 3,328 |
| `GENEmployees` | `ValueId2` | `GENListValues` | `Id` | 824 | 3,328 |
| `GENEmployees` | `ValueId3` | `GENListValues` | `Id` | 824 | 3,328 |
| `GENEmployees` | `ValueId4` | `GENListValues` | `Id` | 824 | 3,328 |
| `GENEmployees` | `ValueId5` | `GENListValues` | `Id` | 824 | 3,328 |
| `GENEmployees` | `SalutationId` | `GENSalutations` | `Id` | 824 | 19 |
| `GENEmployees` | `IconId` | `GENStyles` | `Id` | 824 | 1,445 |
| `GENEntityClassifications` | `BaseEntityId` | `BaseEntities` | `Id` | 0 | 203 |
| `GENEntityClassifications` | `ClassificationId` | `GENClassifications` | `Id` | 0 | 2 |
| `GENEntityClassifications` | `LanguageId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENEntityPricings` | `BaseEntityId` | `BaseEntities` | `Id` | 647 | 203 |
| `GENEntityPricings` | `CurrencyId` | `GENCurrencies` | `Id` | 647 | 2 |
| `GENEntityPricings` | `LanguageId` | `GENListValues` | `Id` | 647 | 3,328 |
| `GENEntityPricings` | `RegionId` | `GENRegions` | `Id` | 647 | 8 |
| `GENEntityPricings` | `UnitId` | `GENUnits` | `Id` | 647 | 1 |
| `GENEntitySpecifications` | `BaseEntityId` | `BaseEntities` | `Id` | 0 | 203 |
| `GENEntitySpecifications` | `SpecificationId` | `GENSpecifications` | `Id` | 0 | 0 |
| `GENEntitySpecifications` | `UnitId` | `GENUnits` | `Id` | 0 | 1 |
| `GENEntity_GENWiki` | `BaseEntityId` | `BaseEntities` | `Id` | 18 | 203 |
| `GENEntity_GENWiki` | `WikiId` | `GENWikis` | `Id` | 18 | 648 |
| `GENEntity_Tag` | `BaseEntityId` | `BaseEntities` | `Id` | 5 | 203 |
| `GENEntity_Tag` | `TagId` | `GENTags` | `Id` | 5 | 1 |
| `GENExamAnswerDetails` | `ExamAnswerHeaderId` | `GENExamAnswerHeaders` | `Id` | 99,737 | 17,156 |
| `GENExamAnswerDetails` | `PollAnswerId` | `GENPollAnswers` | `Id` | 99,737 | 1,876 |
| `GENExamAnswerDetails` | `PollId` | `GENPolls` | `Id` | 99,737 | 734 |
| `GENExamAnswerHeaders` | `ClassroomId` | `GENClassrooms` | `Id` | 17,156 | 2,996 |
| `GENExamAnswerHeaders` | `StudentId` | `GENContacts` | `Id` | 17,156 | 51,607 |
| `GENExamAnswerHeaders` | `InstructorId` | `GENEmployees` | `Id` | 17,156 | 824 |
| `GENExamAnswerHeaders` | `ValueId1` | `GENListValues` | `Id` | 17,156 | 3,328 |
| `GENExamAnswerHeaders` | `ValueId2` | `GENListValues` | `Id` | 17,156 | 3,328 |
| `GENExamAnswerHeaders` | `ValueId3` | `GENListValues` | `Id` | 17,156 | 3,328 |
| `GENExamAnswerHeaders` | `ValueId4` | `GENListValues` | `Id` | 17,156 | 3,328 |
| `GENExamAnswerHeaders` | `ValueId5` | `GENListValues` | `Id` | 17,156 | 3,328 |
| `GENExamAnswerHeaders` | `ExamId` | `GENPollCategories` | `Id` | 17,156 | 65 |
| `GENExamAnswerHeaders` | `IconId` | `GENStyles` | `Id` | 17,156 | 1,445 |
| `GENExamAnswerHeaders` | `CourseId` | `GENTypes` | `Id` | 17,156 | 416 |
| `GENExamAutoGenerators` | `LanguageId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENExamGeneratorTags` | `ExamGeneratorId` | `GENExamAutoGenerators` | `Id` | 0 | 0 |
| `GENExamGeneratorTags` | `TagId` | `GENTags` | `Id` | 0 | 1 |
| `GENExam_GENClassroom` | `ClassroomId` | `GENClassrooms` | `Id` | 1,213 | 2,996 |
| `GENExam_GENClassroom` | `ExamId` | `GENPollCategories` | `Id` | 1,213 | 65 |
| `GENExam_GENItem` | `SessionId` | `GENItems` | `Id` | 1 | 5,180 |
| `GENExam_GENItem` | `ExamId` | `GENPollCategories` | `Id` | 1 | 65 |
| `GENExam_GENTalent` | `ExamId` | `GENPollCategories` | `Id` | 0 | 65 |
| `GENExam_GENTalent` | `TalentId` | `GENTalents` | `Id` | 0 | 108 |
| `GENExam_GENType` | `ExamId` | `GENPollCategories` | `Id` | 239 | 65 |
| `GENExam_GENType` | `CourseId` | `GENTypes` | `Id` | 239 | 416 |
| `GENExam_Generic` | `BaseEntityId` | `BaseEntities` | `Id` | 0 | 203 |
| `GENExam_Generic` | `ExamId` | `GENPollCategories` | `Id` | 0 | 65 |
| `GENFeedBackCategories` | `ValueId1` | `GENListValues` | `Id` | 9 | 3,328 |
| `GENFeedBackCategories` | `ValueId2` | `GENListValues` | `Id` | 9 | 3,328 |
| `GENFeedBackCategories` | `ValueId3` | `GENListValues` | `Id` | 9 | 3,328 |
| `GENFeedBackCategories` | `ValueId4` | `GENListValues` | `Id` | 9 | 3,328 |
| `GENFeedBackCategories` | `ValueId5` | `GENListValues` | `Id` | 9 | 3,328 |
| `GENFeedBackCategories` | `IconId` | `GENStyles` | `Id` | 9 | 1,445 |
| `GENFeedBacks` | `BranchId` | `GENBranches` | `Id` | 10,810 | 2 |
| `GENFeedBacks` | `BrandId` | `GENBrands` | `Id` | 10,810 | 10 |
| `GENFeedBacks` | `ClassroomId` | `GENClassrooms` | `Id` | 10,810 | 2,996 |
| `GENFeedBacks` | `EmployeeId` | `GENEmployees` | `Id` | 10,810 | 824 |
| `GENFeedBacks` | `FeedBackCategoryId` | `GENFeedBackCategories` | `Id` | 10,810 | 9 |
| `GENFeedBacks` | `ValueId1` | `GENListValues` | `Id` | 10,810 | 3,328 |
| `GENFeedBacks` | `ValueId2` | `GENListValues` | `Id` | 10,810 | 3,328 |
| `GENFeedBacks` | `ValueId3` | `GENListValues` | `Id` | 10,810 | 3,328 |
| `GENFeedBacks` | `ValueId4` | `GENListValues` | `Id` | 10,810 | 3,328 |
| `GENFeedBacks` | `ValueId5` | `GENListValues` | `Id` | 10,810 | 3,328 |
| `GENFeedBacks` | `StatusId` | `GENStatus` | `Id` | 10,810 | 9 |
| `GENFeedBacks` | `IconId` | `GENStyles` | `Id` | 10,810 | 1,445 |
| `GENFeedBacks` | `CourseId` | `GENTypes` | `Id` | 10,810 | 416 |
| `GENFeedbackReplies` | `BaseEntityId` | `BaseEntities` | `Id` | 2,522 | 203 |
| `GENFileAttachments` | `BaseEntityId` | `BaseEntities` | `Id` | 0 | 203 |
| `GENFileAttachments` | `BrandId` | `GENBrands` | `Id` | 0 | 10 |
| `GENFileAttachments` | `ClassroomId` | `GENClassrooms` | `Id` | 0 | 2,996 |
| `GENFileAttachments` | `EmployeeId` | `GENEmployees` | `Id` | 0 | 824 |
| `GENFileAttachments` | `CategoryId` | `GENItemCategories` | `Id` | 0 | 3 |
| `GENFileAttachments` | `ItemId` | `GENItems` | `Id` | 0 | 5,180 |
| `GENFileAttachments` | `ValueId1` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENFileAttachments` | `ValueId2` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENFileAttachments` | `ValueId3` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENFileAttachments` | `ValueId4` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENFileAttachments` | `ValueId5` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENFileAttachments` | `SectionId` | `GENSections` | `Id` | 0 | 2 |
| `GENFileAttachments` | `IconId` | `GENStyles` | `Id` | 0 | 1,445 |
| `GENFileAttachments` | `TalentId` | `GENTalents` | `Id` | 0 | 108 |
| `GENFileAttachments` | `CourseId` | `GENTypes` | `Id` | 0 | 416 |
| `GENFiles` | `BaseEntityId` | `BaseEntities` | `Id` | 31,339 | 203 |
| `GENFiles` | `FileTypeId` | `GENListValues` | `Id` | 31,339 | 3,328 |
| `GENFiles` | `LanguageId` | `GENListValues` | `Id` | 31,339 | 3,328 |
| `GENGalleryAlbumCategories` | `ValueId1` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENGalleryAlbumCategories` | `ValueId2` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENGalleryAlbumCategories` | `ValueId3` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENGalleryAlbumCategories` | `ValueId4` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENGalleryAlbumCategories` | `ValueId5` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENGalleryAlbumCategories` | `IconId` | `GENStyles` | `Id` | 0 | 1,445 |
| `GENGalleryAlbumImages` | `GalleryAlbumId` | `GENGalleryAlbums` | `Id` | 0 | 0 |
| `GENGalleryAlbumImages` | `ValueId1` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENGalleryAlbumImages` | `ValueId2` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENGalleryAlbumImages` | `ValueId3` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENGalleryAlbumImages` | `ValueId4` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENGalleryAlbumImages` | `ValueId5` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENGalleryAlbumImages` | `IconId` | `GENStyles` | `Id` | 0 | 1,445 |
| `GENGalleryAlbums` | `BrandId` | `GENBrands` | `Id` | 0 | 10 |
| `GENGalleryAlbums` | `GalleryAlbumCategoryId` | `GENGalleryAlbumCategories` | `Id` | 0 | 0 |
| `GENGalleryAlbums` | `ItemCategoryId` | `GENItemCategories` | `Id` | 0 | 3 |
| `GENGalleryAlbums` | `ValueId1` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENGalleryAlbums` | `ValueId2` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENGalleryAlbums` | `ValueId3` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENGalleryAlbums` | `ValueId4` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENGalleryAlbums` | `ValueId5` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENGalleryAlbums` | `SectionId` | `GENSections` | `Id` | 0 | 2 |
| `GENGalleryAlbums` | `IconId` | `GENStyles` | `Id` | 0 | 1,445 |
| `GENGenericCodes` | `BaseEntityId` | `BaseEntities` | `Id` | 0 | 203 |
| `GENGenericCodes` | `PageofPageId` | `GENPageOfPages` | `Id` | 0 | 348 |
| `GENGovernorates` | `ValueId1` | `GENListValues` | `Id` | 9 | 3,328 |
| `GENGovernorates` | `ValueId2` | `GENListValues` | `Id` | 9 | 3,328 |
| `GENGovernorates` | `ValueId3` | `GENListValues` | `Id` | 9 | 3,328 |
| `GENGovernorates` | `ValueId4` | `GENListValues` | `Id` | 9 | 3,328 |
| `GENGovernorates` | `ValueId5` | `GENListValues` | `Id` | 9 | 3,328 |
| `GENGovernorates` | `ProvinceId` | `GENProvinces` | `Id` | 9 | 2 |
| `GENGovernorates` | `IconId` | `GENStyles` | `Id` | 9 | 1,445 |
| `GENHomeSliderCategories` | `ValueId1` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENHomeSliderCategories` | `ValueId2` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENHomeSliderCategories` | `ValueId3` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENHomeSliderCategories` | `ValueId4` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENHomeSliderCategories` | `ValueId5` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENHomeSliderCategories` | `IconId` | `GENStyles` | `Id` | 0 | 1,445 |
| `GENHomeSliders` | `HomeSliderCategoryId` | `GENHomeSliderCategories` | `Id` | 6 | 0 |
| `GENHomeSliders` | `ValueId1` | `GENListValues` | `Id` | 6 | 3,328 |
| `GENHomeSliders` | `ValueId2` | `GENListValues` | `Id` | 6 | 3,328 |
| `GENHomeSliders` | `ValueId3` | `GENListValues` | `Id` | 6 | 3,328 |
| `GENHomeSliders` | `ValueId4` | `GENListValues` | `Id` | 6 | 3,328 |
| `GENHomeSliders` | `ValueId5` | `GENListValues` | `Id` | 6 | 3,328 |
| `GENHomeSliders` | `SectionId` | `GENSections` | `Id` | 6 | 2 |
| `GENHomeSliders` | `IconId` | `GENStyles` | `Id` | 6 | 1,445 |
| `GENImageTypes` | `ValueId1` | `GENListValues` | `Id` | 95 | 3,328 |
| `GENImageTypes` | `ValueId2` | `GENListValues` | `Id` | 95 | 3,328 |
| `GENImageTypes` | `ValueId3` | `GENListValues` | `Id` | 95 | 3,328 |
| `GENImageTypes` | `ValueId4` | `GENListValues` | `Id` | 95 | 3,328 |
| `GENImageTypes` | `ValueId5` | `GENListValues` | `Id` | 95 | 3,328 |
| `GENImageTypes` | `PageofPageId` | `GENPageOfPages` | `Id` | 95 | 348 |
| `GENImageTypes` | `IconId` | `GENStyles` | `Id` | 95 | 1,445 |
| `GENImages` | `BaseEntityId` | `BaseEntities` | `Id` | 1,793 | 203 |
| `GENImages` | `ImageTypeId` | `GENImageTypes` | `Id` | 1,793 | 95 |
| `GENImages` | `LanguageId` | `GENListValues` | `Id` | 1,793 | 3,328 |
| `GENIndustries` | `IndustryCategoryId` | `GENIndustryCategories` | `Id` | 25 | 0 |
| `GENIndustries` | `ValueId1` | `GENListValues` | `Id` | 25 | 3,328 |
| `GENIndustries` | `ValueId2` | `GENListValues` | `Id` | 25 | 3,328 |
| `GENIndustries` | `ValueId3` | `GENListValues` | `Id` | 25 | 3,328 |
| `GENIndustries` | `ValueId4` | `GENListValues` | `Id` | 25 | 3,328 |
| `GENIndustries` | `ValueId5` | `GENListValues` | `Id` | 25 | 3,328 |
| `GENIndustries` | `IconId` | `GENStyles` | `Id` | 25 | 1,445 |
| `GENIndustryCategories` | `ValueId1` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENIndustryCategories` | `ValueId2` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENIndustryCategories` | `ValueId3` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENIndustryCategories` | `ValueId4` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENIndustryCategories` | `ValueId5` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENIndustryCategories` | `IconId` | `GENStyles` | `Id` | 0 | 1,445 |
| `GENItemAttachments` | `ItemId` | `GENItems` | `Id` | 0 | 5,180 |
| `GENItemAudios` | `ItemId` | `GENItems` | `Id` | 0 | 5,180 |
| `GENItemCategories` | `ParentId` | `GENItemCategories` | `Id` | 3 | 3 |
| `GENItemCategories` | `ValueId1` | `GENListValues` | `Id` | 3 | 3,328 |
| `GENItemCategories` | `ValueId2` | `GENListValues` | `Id` | 3 | 3,328 |
| `GENItemCategories` | `ValueId3` | `GENListValues` | `Id` | 3 | 3,328 |
| `GENItemCategories` | `ValueId4` | `GENListValues` | `Id` | 3 | 3,328 |
| `GENItemCategories` | `ValueId5` | `GENListValues` | `Id` | 3 | 3,328 |
| `GENItemCategories` | `IconId` | `GENStyles` | `Id` | 3 | 1,445 |
| `GENItemCategoryImages` | `ItemCategoryId` | `GENItemCategories` | `Id` | 0 | 3 |
| `GENItemCategory_Item` | `ItemCategoryId` | `GENItemCategories` | `Id` | 0 | 3 |
| `GENItemCategory_Item` | `ItemId` | `GENItems` | `Id` | 0 | 5,180 |
| `GENItemCategory_Item` | `ValueId1` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENItemCategory_Item` | `ValueId2` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENItemCategory_Item` | `ValueId3` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENItemCategory_Item` | `ValueId4` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENItemCategory_Item` | `ValueId5` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENItemCategory_Item` | `IconId` | `GENStyles` | `Id` | 0 | 1,445 |
| `GENItemCompetitions` | `CompetitionId` | `GENCompetitions` | `Id` | 0 | 0 |
| `GENItemCompetitions` | `ItemId` | `GENItems` | `Id` | 0 | 5,180 |
| `GENItemDetails` | `ItemId` | `GENItems` | `Id` | 0 | 5,180 |
| `GENItemDetails` | `ValueId1` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENItemDetails` | `ValueId2` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENItemDetails` | `ValueId3` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENItemDetails` | `ValueId4` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENItemDetails` | `ValueId5` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENItemDetails` | `IconId` | `GENStyles` | `Id` | 0 | 1,445 |
| `GENItemFiles` | `ItemId` | `GENItems` | `Id` | 1,330 | 5,180 |
| `GENItemFiles` | `LanguageId` | `GENListValues` | `Id` | 1,330 | 3,328 |
| `GENItemGroup_Item` | `ItemGroupId` | `GENItemGroups` | `Id` | 0 | 0 |
| `GENItemGroup_Item` | `ItemId` | `GENItems` | `Id` | 0 | 5,180 |
| `GENItemGroup_Item` | `ValueId1` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENItemGroup_Item` | `ValueId2` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENItemGroup_Item` | `ValueId3` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENItemGroup_Item` | `ValueId4` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENItemGroup_Item` | `ValueId5` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENItemGroup_Item` | `IconId` | `GENStyles` | `Id` | 0 | 1,445 |
| `GENItemGroups` | `ValueId1` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENItemGroups` | `ValueId2` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENItemGroups` | `ValueId3` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENItemGroups` | `ValueId4` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENItemGroups` | `ValueId5` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENItemGroups` | `IconId` | `GENStyles` | `Id` | 0 | 1,445 |
| `GENItemImages` | `ItemId` | `GENItems` | `Id` | 0 | 5,180 |
| `GENItemImages` | `ValueId1` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENItemImages` | `ValueId2` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENItemImages` | `ValueId3` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENItemImages` | `ValueId4` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENItemImages` | `ValueId5` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENItemImages` | `IconId` | `GENStyles` | `Id` | 0 | 1,445 |
| `GENItemPackings` | `ItemId` | `GENItems` | `Id` | 0 | 5,180 |
| `GENItemPackings` | `MainUnitId` | `GENUnits` | `Id` | 0 | 1 |
| `GENItemPromotions` | `ItemId` | `GENItems` | `Id` | 0 | 5,180 |
| `GENItemPromotions` | `ValueId1` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENItemPromotions` | `ValueId2` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENItemPromotions` | `ValueId3` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENItemPromotions` | `ValueId4` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENItemPromotions` | `ValueId5` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENItemPromotions` | `IconId` | `GENStyles` | `Id` | 0 | 1,445 |
| `GENItemTags` | `ItemId` | `GENItems` | `Id` | 0 | 5,180 |
| `GENItemTags` | `TagId` | `GENTags` | `Id` | 0 | 1 |
| `GENItemToItemPointerTypes` | `ValueId1` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENItemToItemPointerTypes` | `ValueId2` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENItemToItemPointerTypes` | `ValueId3` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENItemToItemPointerTypes` | `ValueId4` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENItemToItemPointerTypes` | `ValueId5` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENItemToItemPointerTypes` | `IconId` | `GENStyles` | `Id` | 0 | 1,445 |
| `GENItemToItemPointers` | `ItemToItemPointerTypeId` | `GENItemToItemPointerTypes` | `Id` | 0 | 0 |
| `GENItemToItemPointers` | `ItemId` | `GENItems` | `Id` | 0 | 5,180 |
| `GENItemToItemPointers` | `ValueId1` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENItemToItemPointers` | `ValueId2` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENItemToItemPointers` | `ValueId3` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENItemToItemPointers` | `ValueId4` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENItemToItemPointers` | `ValueId5` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENItemToItemPointers` | `IconId` | `GENStyles` | `Id` | 0 | 1,445 |
| `GENItemVideos` | `ItemId` | `GENItems` | `Id` | 528 | 5,180 |
| `GENItemVideos` | `LanguageId` | `GENListValues` | `Id` | 528 | 3,328 |
| `GENItem_Bundle` | `ItemId` | `GENItems` | `Id` | 0 | 5,180 |
| `GENItem_Link` | `ItemLinkTypeId` | `GENItem_LinkTypes` | `Id` | 0 | 0 |
| `GENItem_Link` | `ItemId` | `GENItems` | `Id` | 0 | 5,180 |
| `GENItem_Link` | `ValueId1` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENItem_Link` | `ValueId2` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENItem_Link` | `ValueId3` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENItem_Link` | `ValueId4` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENItem_Link` | `ValueId5` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENItem_Link` | `IconId` | `GENStyles` | `Id` | 0 | 1,445 |
| `GENItem_LinkTypes` | `ValueId1` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENItem_LinkTypes` | `ValueId2` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENItem_LinkTypes` | `ValueId3` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENItem_LinkTypes` | `ValueId4` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENItem_LinkTypes` | `ValueId5` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENItem_LinkTypes` | `IconId` | `GENStyles` | `Id` | 0 | 1,445 |
| `GENItem_Sessions` | `DependencySessionId` | `GENItems` | `Id` | 0 | 5,180 |
| `GENItem_Sessions` | `MainSessionId` | `GENItems` | `Id` | 0 | 5,180 |
| `GENItem_Specification` | `ItemId` | `GENItems` | `Id` | 0 | 5,180 |
| `GENItem_Specification` | `SpecificationId` | `GENSpecifications` | `Id` | 0 | 0 |
| `GENItem_Specification` | `UnitId` | `GENUnits` | `Id` | 0 | 1 |
| `GENItems` | `DeletedById` | `AspNetUsers` | `Id` | 5,180 | 40,910 |
| `GENItems` | `BrandId` | `GENBrands` | `Id` | 5,180 | 10 |
| `GENItems` | `ClassificationId` | `GENClassifications` | `Id` | 5,180 | 2 |
| `GENItems` | `CompanyId` | `GENCompanies` | `Id` | 5,180 | 6,045 |
| `GENItems` | `OwnerId` | `GENContacts` | `Id` | 5,180 | 51,607 |
| `GENItems` | `OriginId` | `GENCountries` | `Id` | 5,180 | 174 |
| `GENItems` | `ExtListValue1Id` | `GENListValues` | `Id` | 5,180 | 3,328 |
| `GENItems` | `ValueId1` | `GENListValues` | `Id` | 5,180 | 3,328 |
| `GENItems` | `ValueId2` | `GENListValues` | `Id` | 5,180 | 3,328 |
| `GENItems` | `ValueId3` | `GENListValues` | `Id` | 5,180 | 3,328 |
| `GENItems` | `ValueId4` | `GENListValues` | `Id` | 5,180 | 3,328 |
| `GENItems` | `ValueId5` | `GENListValues` | `Id` | 5,180 | 3,328 |
| `GENItems` | `ProjectId` | `GENProjects` | `Id` | 5,180 | 0 |
| `GENItems` | `IconId` | `GENStyles` | `Id` | 5,180 | 1,445 |
| `GENItems` | `TypeId` | `GENTypes` | `Id` | 5,180 | 416 |
| `GENItems` | `UnitId` | `GENUnits` | `Id` | 5,180 | 1 |
| `GENLinks` | `BaseEntityId` | `BaseEntities` | `Id` | 271 | 203 |
| `GENLinks` | `LinkTypeId` | `GENItem_LinkTypes` | `Id` | 271 | 0 |
| `GENListValues` | `ValueId1` | `GENListValues` | `Id` | 3,328 | 3,328 |
| `GENListValues` | `ValueId2` | `GENListValues` | `Id` | 3,328 | 3,328 |
| `GENListValues` | `ValueId3` | `GENListValues` | `Id` | 3,328 | 3,328 |
| `GENListValues` | `ValueId4` | `GENListValues` | `Id` | 3,328 | 3,328 |
| `GENListValues` | `ValueId5` | `GENListValues` | `Id` | 3,328 | 3,328 |
| `GENListValues` | `GENListValuesTypeId` | `GENListValuesTypes` | `Id` | 3,328 | 50 |
| `GENListValues` | `GENListValuesType_Id` | `GENListValuesTypes` | `Id` | 3,328 | 50 |
| `GENListValues` | `IconId` | `GENStyles` | `Id` | 3,328 | 1,445 |
| `GENListValuesTypes` | `ValueId1` | `GENListValues` | `Id` | 50 | 3,328 |
| `GENListValuesTypes` | `ValueId2` | `GENListValues` | `Id` | 50 | 3,328 |
| `GENListValuesTypes` | `ValueId3` | `GENListValues` | `Id` | 50 | 3,328 |
| `GENListValuesTypes` | `ValueId4` | `GENListValues` | `Id` | 50 | 3,328 |
| `GENListValuesTypes` | `ValueId5` | `GENListValues` | `Id` | 50 | 3,328 |
| `GENMessage_Status` | `BaseEntityId` | `BaseEntities` | `Id` | 0 | 203 |
| `GENMessage_Status` | `StatusId` | `GENStatus` | `Id` | 0 | 9 |
| `GENMessagesPushNotifications` | `LangId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENMessagesPushNotifications` | `ValueId1` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENMessagesPushNotifications` | `ValueId2` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENMessagesPushNotifications` | `ValueId3` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENMessagesPushNotifications` | `ValueId4` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENMessagesPushNotifications` | `ValueId5` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENMessagesPushNotifications` | `IconId` | `GENStyles` | `Id` | 0 | 1,445 |
| `GENNews` | `BaseEntityId` | `BaseEntities` | `Id` | 5 | 203 |
| `GENNews` | `BranchId` | `GENBranches` | `Id` | 5 | 2 |
| `GENNews` | `BrandId` | `GENBrands` | `Id` | 5 | 10 |
| `GENNews` | `ValueId1` | `GENListValues` | `Id` | 5 | 3,328 |
| `GENNews` | `ValueId2` | `GENListValues` | `Id` | 5 | 3,328 |
| `GENNews` | `ValueId3` | `GENListValues` | `Id` | 5 | 3,328 |
| `GENNews` | `ValueId4` | `GENListValues` | `Id` | 5 | 3,328 |
| `GENNews` | `ValueId5` | `GENListValues` | `Id` | 5 | 3,328 |
| `GENNews` | `NewsCategoryId` | `GENNewsCategories` | `Id` | 5 | 2 |
| `GENNews` | `SectionsId` | `GENSections` | `Id` | 5 | 2 |
| `GENNews` | `IconId` | `GENStyles` | `Id` | 5 | 1,445 |
| `GENNewsCategories` | `ValueId1` | `GENListValues` | `Id` | 2 | 3,328 |
| `GENNewsCategories` | `ValueId2` | `GENListValues` | `Id` | 2 | 3,328 |
| `GENNewsCategories` | `ValueId3` | `GENListValues` | `Id` | 2 | 3,328 |
| `GENNewsCategories` | `ValueId4` | `GENListValues` | `Id` | 2 | 3,328 |
| `GENNewsCategories` | `ValueId5` | `GENListValues` | `Id` | 2 | 3,328 |
| `GENNewsCategories` | `IconId` | `GENStyles` | `Id` | 2 | 1,445 |
| `GENNewsletters` | `ValueId1` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENNewsletters` | `ValueId2` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENNewsletters` | `ValueId3` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENNewsletters` | `ValueId4` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENNewsletters` | `ValueId5` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENNewsletters` | `IconId` | `GENStyles` | `Id` | 0 | 1,445 |
| `GENNotificationsRelatedDatas` | `PushNotificationId` | `GENPushNotifications` | `Id` | 0 | 108,215 |
| `GENOrderCategories` | `ValueId1` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENOrderCategories` | `ValueId2` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENOrderCategories` | `ValueId3` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENOrderCategories` | `ValueId4` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENOrderCategories` | `ValueId5` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENOrderCategories` | `IconId` | `GENStyles` | `Id` | 0 | 1,445 |
| `GENOrderDetailSpecs` | `SpecificationId` | `GENItem_Specification` | `Id` | 0 | 0 |
| `GENOrderDetailSpecs` | `OrderDetailId` | `GENOrderDetails` | `Id` | 0 | 3,701 |
| `GENOrderDetails` | `BaseEntityId` | `BaseEntities` | `Id` | 3,701 | 203 |
| `GENOrderDetails` | `CurrencyId` | `GENCurrencies` | `Id` | 3,701 | 2 |
| `GENOrderDetails` | `ItemId` | `GENItems` | `Id` | 3,701 | 5,180 |
| `GENOrderDetails` | `OrderId` | `GENOrders` | `Id` | 3,701 | 3,701 |
| `GENOrderDetails` | `UnitId` | `GENUnits` | `Id` | 3,701 | 1 |
| `GENOrders` | `UserAddressId` | `AspNetUserAddresses` | `Id` | 3,701 | 0 |
| `GENOrders` | `UserId` | `AspNetUsers` | `Id` | 3,701 | 40,910 |
| `GENOrders` | `BranchId` | `GENBranches` | `Id` | 3,701 | 2 |
| `GENOrders` | `CertificationRequestId` | `GENCertification_Requests` | `Id` | 3,701 | 0 |
| `GENOrders` | `VcrId` | `GENClassrooms` | `Id` | 3,701 | 2,996 |
| `GENOrders` | `ContactId` | `GENContacts` | `Id` | 3,701 | 51,607 |
| `GENOrders` | `CurrencyId` | `GENCurrencies` | `Id` | 3,701 | 2 |
| `GENOrders` | `ValueId1` | `GENListValues` | `Id` | 3,701 | 3,328 |
| `GENOrders` | `ValueId2` | `GENListValues` | `Id` | 3,701 | 3,328 |
| `GENOrders` | `ValueId3` | `GENListValues` | `Id` | 3,701 | 3,328 |
| `GENOrders` | `ValueId4` | `GENListValues` | `Id` | 3,701 | 3,328 |
| `GENOrders` | `ValueId5` | `GENListValues` | `Id` | 3,701 | 3,328 |
| `GENOrders` | `OrderCategoryId` | `GENOrderCategories` | `Id` | 3,701 | 0 |
| `GENOrders` | `StatusId` | `GENStatus` | `Id` | 3,701 | 9 |
| `GENOrders` | `IconId` | `GENStyles` | `Id` | 3,701 | 1,445 |
| `GENOrders` | `TalentId` | `GENTalents` | `Id` | 3,701 | 108 |
| `GENOrders` | `TypeId` | `GENTypes` | `Id` | 3,701 | 416 |
| `GENPageOfPages` | `EntityId` | `BaseEntities` | `Id` | 348 | 203 |
| `GENPageOfPages` | `BackendPageId` | `GENBackendPages` | `Id` | 348 | 261 |
| `GENPageOfPages` | `GENListValuesTypeId` | `GENListValuesTypes` | `Id` | 348 | 50 |
| `GENPageOfPages` | `StyleId` | `GENStyles` | `Id` | 348 | 1,445 |
| `GENPageOfPages` | `TypeStatusId` | `GENTypeStatus` | `Id` | 348 | 15 |
| `GENPageOfPages` | `HTMLTemplateId` | `HTMLTemplates` | `Id` | 348 | 5 |
| `GENPageOfPages` | `ReportId` | `Reports` | `Id` | 348 | 53 |
| `GENPaymenetEntities` | `BaseEntityId` | `BaseEntities` | `Id` | 0 | 203 |
| `GENPaymenetEntities` | `PayementMethodId` | `GENPaymentMethods` | `Id` | 0 | 7 |
| `GENPaymentMethods` | `ValueId1` | `GENListValues` | `Id` | 7 | 3,328 |
| `GENPaymentMethods` | `ValueId2` | `GENListValues` | `Id` | 7 | 3,328 |
| `GENPaymentMethods` | `ValueId3` | `GENListValues` | `Id` | 7 | 3,328 |
| `GENPaymentMethods` | `ValueId4` | `GENListValues` | `Id` | 7 | 3,328 |
| `GENPaymentMethods` | `ValueId5` | `GENListValues` | `Id` | 7 | 3,328 |
| `GENPaymentMethods` | `IconId` | `GENStyles` | `Id` | 7 | 1,445 |
| `GENPaymentPlans` | `TimeUnitId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENPaymentPlans` | `ValueId1` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENPaymentPlans` | `ValueId2` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENPaymentPlans` | `ValueId3` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENPaymentPlans` | `ValueId4` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENPaymentPlans` | `ValueId5` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENPaymentPlans` | `IconId` | `GENStyles` | `Id` | 0 | 1,445 |
| `GENPaymentTransactions` | `OrderId` | `GENOrders` | `Id` | 0 | 3,701 |
| `GENPaymentTransactions` | `PaymenthMethodId` | `GENPaymentMethods` | `Id` | 0 | 7 |
| `GENPaymentTransactions` | `StatusId` | `GENStatus` | `Id` | 0 | 9 |
| `GENPerson_Details` | `BaseEntityId` | `BaseEntities` | `Id` | 0 | 203 |
| `GENPerson_Details` | `CompanyId` | `GENCompanies` | `Id` | 0 | 6,045 |
| `GENPerson_Details` | `GovernorateId` | `GENGovernorates` | `Id` | 0 | 9 |
| `GENPerson_Details` | `BirthplaceId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENPerson_Details` | `EmployerId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENPerson_Details` | `GenderId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENPerson_Details` | `JobId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENPerson_Details` | `NationalityId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENPerson_Details` | `PositionRecruitmentId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENPerson_Details` | `QualificationId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENPerson_Details` | `ReligionId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENPerson_Details` | `SocialStatusId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENPerson_Details` | `TypeofPersonalizationId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENPerson_Details` | `salutationId` | `GENSalutations` | `Id` | 0 | 19 |
| `GENPhoneTypes` | `ValueId1` | `GENListValues` | `Id` | 6 | 3,328 |
| `GENPhoneTypes` | `ValueId2` | `GENListValues` | `Id` | 6 | 3,328 |
| `GENPhoneTypes` | `ValueId3` | `GENListValues` | `Id` | 6 | 3,328 |
| `GENPhoneTypes` | `ValueId4` | `GENListValues` | `Id` | 6 | 3,328 |
| `GENPhoneTypes` | `ValueId5` | `GENListValues` | `Id` | 6 | 3,328 |
| `GENPhoneTypes` | `IconId` | `GENStyles` | `Id` | 6 | 1,445 |
| `GENPhones` | `BaseEntityId` | `BaseEntities` | `Id` | 398 | 203 |
| `GENPhones` | `PhoneTypeId` | `GENPhoneTypes` | `Id` | 398 | 6 |
| `GENPointers` | `BaseEntityId` | `BaseEntities` | `Id` | 10,622 | 203 |
| `GENPollAnswers` | `ValueId1` | `GENListValues` | `Id` | 1,876 | 3,328 |
| `GENPollAnswers` | `ValueId2` | `GENListValues` | `Id` | 1,876 | 3,328 |
| `GENPollAnswers` | `ValueId3` | `GENListValues` | `Id` | 1,876 | 3,328 |
| `GENPollAnswers` | `ValueId4` | `GENListValues` | `Id` | 1,876 | 3,328 |
| `GENPollAnswers` | `ValueId5` | `GENListValues` | `Id` | 1,876 | 3,328 |
| `GENPollAnswers` | `PollId` | `GENPolls` | `Id` | 1,876 | 734 |
| `GENPollAnswers` | `IconId` | `GENStyles` | `Id` | 1,876 | 1,445 |
| `GENPollCategories` | `ExamAutoGeneratorId` | `GENExamAutoGenerators` | `Id` | 65 | 0 |
| `GENPollCategories` | `LanguageId` | `GENListValues` | `Id` | 65 | 3,328 |
| `GENPollCategories` | `ValueId1` | `GENListValues` | `Id` | 65 | 3,328 |
| `GENPollCategories` | `ValueId2` | `GENListValues` | `Id` | 65 | 3,328 |
| `GENPollCategories` | `ValueId3` | `GENListValues` | `Id` | 65 | 3,328 |
| `GENPollCategories` | `ValueId4` | `GENListValues` | `Id` | 65 | 3,328 |
| `GENPollCategories` | `ValueId5` | `GENListValues` | `Id` | 65 | 3,328 |
| `GENPollCategories` | `IconId` | `GENStyles` | `Id` | 65 | 1,445 |
| `GENPolls` | `LanguageId` | `GENListValues` | `Id` | 734 | 3,328 |
| `GENPolls` | `ValueId1` | `GENListValues` | `Id` | 734 | 3,328 |
| `GENPolls` | `ValueId2` | `GENListValues` | `Id` | 734 | 3,328 |
| `GENPolls` | `ValueId3` | `GENListValues` | `Id` | 734 | 3,328 |
| `GENPolls` | `ValueId4` | `GENListValues` | `Id` | 734 | 3,328 |
| `GENPolls` | `ValueId5` | `GENListValues` | `Id` | 734 | 3,328 |
| `GENPolls` | `IconId` | `GENStyles` | `Id` | 734 | 1,445 |
| `GENProcessHistories` | `BaseEntityId` | `BaseEntities` | `Id` | 0 | 203 |
| `GENProcessHistories` | `CreatedToId` | `GENEmployees` | `Id` | 0 | 824 |
| `GENProcessHistories` | `ProcessId` | `GENProcesses` | `Id` | 0 | 0 |
| `GENProcesses` | `BaseEntityId` | `BaseEntities` | `Id` | 0 | 203 |
| `GENProcesses` | `ListValueId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENProcesses` | `ProcessId` | `GENStatus` | `Id` | 0 | 9 |
| `GENProfessionalExperiences` | `CreatedById` | `AspNetUsers` | `Id` | 2 | 40,910 |
| `GENProfessionalExperiences` | `LastUpdatedById` | `AspNetUsers` | `Id` | 2 | 40,910 |
| `GENProfessionalExperiences` | `BaseEntityId` | `BaseEntities` | `Id` | 2 | 203 |
| `GENProfessionalExperiences` | `EmployeeId` | `GENEmployees` | `Id` | 2 | 824 |
| `GENProjectCategories` | `ValueId1` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENProjectCategories` | `ValueId2` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENProjectCategories` | `ValueId3` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENProjectCategories` | `ValueId4` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENProjectCategories` | `ValueId5` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENProjectCategories` | `IconId` | `GENStyles` | `Id` | 0 | 1,445 |
| `GENProjects` | `SourceId` | `CRMSources` | `Id` | 0 | 18 |
| `GENProjects` | `CompanyId` | `GENCompanies` | `Id` | 0 | 6,045 |
| `GENProjects` | `ContactId` | `GENContacts` | `Id` | 0 | 51,607 |
| `GENProjects` | `ReferralId` | `GENContacts` | `Id` | 0 | 51,607 |
| `GENProjects` | `DistrictId` | `GENDistricts` | `Id` | 0 | 9 |
| `GENProjects` | `ValueId1` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENProjects` | `ValueId2` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENProjects` | `ValueId3` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENProjects` | `ValueId4` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENProjects` | `ValueId5` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENProjects` | `ProjectCategoryId` | `GENProjectCategories` | `Id` | 0 | 0 |
| `GENProjects` | `IconId` | `GENStyles` | `Id` | 0 | 1,445 |
| `GENProvinces` | `CountryId` | `GENCountries` | `Id` | 2 | 174 |
| `GENProvinces` | `ValueId1` | `GENListValues` | `Id` | 2 | 3,328 |
| `GENProvinces` | `ValueId2` | `GENListValues` | `Id` | 2 | 3,328 |
| `GENProvinces` | `ValueId3` | `GENListValues` | `Id` | 2 | 3,328 |
| `GENProvinces` | `ValueId4` | `GENListValues` | `Id` | 2 | 3,328 |
| `GENProvinces` | `ValueId5` | `GENListValues` | `Id` | 2 | 3,328 |
| `GENProvinces` | `IconId` | `GENStyles` | `Id` | 2 | 1,445 |
| `GENPushNotificationArchives` | `RequesterId` | `CRMSRVRequesters` | `Id` | 210 | 0 |
| `GENPushNotificationArchives` | `PlaceId` | `GENCities` | `Id` | 210 | 28 |
| `GENPushNotificationArchives` | `CompanyId` | `GENCompanies` | `Id` | 210 | 6,045 |
| `GENPushNotificationArchives` | `LangId` | `GENListValues` | `Id` | 210 | 3,328 |
| `GENPushNotificationArchives` | `ValueId1` | `GENListValues` | `Id` | 210 | 3,328 |
| `GENPushNotificationArchives` | `ValueId10` | `GENListValues` | `Id` | 210 | 3,328 |
| `GENPushNotificationArchives` | `ValueId11` | `GENListValues` | `Id` | 210 | 3,328 |
| `GENPushNotificationArchives` | `ValueId12` | `GENListValues` | `Id` | 210 | 3,328 |
| `GENPushNotificationArchives` | `ValueId13` | `GENListValues` | `Id` | 210 | 3,328 |
| `GENPushNotificationArchives` | `ValueId14` | `GENListValues` | `Id` | 210 | 3,328 |
| `GENPushNotificationArchives` | `ValueId15` | `GENListValues` | `Id` | 210 | 3,328 |
| `GENPushNotificationArchives` | `ValueId16` | `GENListValues` | `Id` | 210 | 3,328 |
| `GENPushNotificationArchives` | `ValueId17` | `GENListValues` | `Id` | 210 | 3,328 |
| `GENPushNotificationArchives` | `ValueId18` | `GENListValues` | `Id` | 210 | 3,328 |
| `GENPushNotificationArchives` | `ValueId19` | `GENListValues` | `Id` | 210 | 3,328 |
| `GENPushNotificationArchives` | `ValueId2` | `GENListValues` | `Id` | 210 | 3,328 |
| `GENPushNotificationArchives` | `ValueId20` | `GENListValues` | `Id` | 210 | 3,328 |
| `GENPushNotificationArchives` | `ValueId3` | `GENListValues` | `Id` | 210 | 3,328 |
| `GENPushNotificationArchives` | `ValueId4` | `GENListValues` | `Id` | 210 | 3,328 |
| `GENPushNotificationArchives` | `ValueId5` | `GENListValues` | `Id` | 210 | 3,328 |
| `GENPushNotificationArchives` | `ValueId6` | `GENListValues` | `Id` | 210 | 3,328 |
| `GENPushNotificationArchives` | `ValueId7` | `GENListValues` | `Id` | 210 | 3,328 |
| `GENPushNotificationArchives` | `ValueId8` | `GENListValues` | `Id` | 210 | 3,328 |
| `GENPushNotificationArchives` | `ValueId9` | `GENListValues` | `Id` | 210 | 3,328 |
| `GENPushNotificationArchives` | `StatusId` | `GENStatus` | `Id` | 210 | 9 |
| `GENPushNotificationArchives` | `IconId` | `GENStyles` | `Id` | 210 | 1,445 |
| `GENPushNotifications` | `RequesterId` | `CRMSRVRequesters` | `Id` | 108,215 | 0 |
| `GENPushNotifications` | `SchedulerId` | `CRMSRVTicket_Comment` | `Id` | 108,215 | 0 |
| `GENPushNotifications` | `BulkPushNotificationId` | `GENBulkPushNotifications` | `Id` | 108,215 | 0 |
| `GENPushNotifications` | `PlaceId` | `GENCities` | `Id` | 108,215 | 28 |
| `GENPushNotifications` | `ActionTypeId` | `GENCommentTypes` | `Id` | 108,215 | 7 |
| `GENPushNotifications` | `CompanyId` | `GENCompanies` | `Id` | 108,215 | 6,045 |
| `GENPushNotifications` | `LangId` | `GENListValues` | `Id` | 108,215 | 3,328 |
| `GENPushNotifications` | `ValueId1` | `GENListValues` | `Id` | 108,215 | 3,328 |
| `GENPushNotifications` | `ValueId10` | `GENListValues` | `Id` | 108,215 | 3,328 |
| `GENPushNotifications` | `ValueId11` | `GENListValues` | `Id` | 108,215 | 3,328 |
| `GENPushNotifications` | `ValueId12` | `GENListValues` | `Id` | 108,215 | 3,328 |
| `GENPushNotifications` | `ValueId13` | `GENListValues` | `Id` | 108,215 | 3,328 |
| `GENPushNotifications` | `ValueId14` | `GENListValues` | `Id` | 108,215 | 3,328 |
| `GENPushNotifications` | `ValueId15` | `GENListValues` | `Id` | 108,215 | 3,328 |
| `GENPushNotifications` | `ValueId16` | `GENListValues` | `Id` | 108,215 | 3,328 |
| `GENPushNotifications` | `ValueId17` | `GENListValues` | `Id` | 108,215 | 3,328 |
| `GENPushNotifications` | `ValueId18` | `GENListValues` | `Id` | 108,215 | 3,328 |
| `GENPushNotifications` | `ValueId19` | `GENListValues` | `Id` | 108,215 | 3,328 |
| `GENPushNotifications` | `ValueId2` | `GENListValues` | `Id` | 108,215 | 3,328 |
| `GENPushNotifications` | `ValueId20` | `GENListValues` | `Id` | 108,215 | 3,328 |
| `GENPushNotifications` | `ValueId3` | `GENListValues` | `Id` | 108,215 | 3,328 |
| `GENPushNotifications` | `ValueId4` | `GENListValues` | `Id` | 108,215 | 3,328 |
| `GENPushNotifications` | `ValueId5` | `GENListValues` | `Id` | 108,215 | 3,328 |
| `GENPushNotifications` | `ValueId6` | `GENListValues` | `Id` | 108,215 | 3,328 |
| `GENPushNotifications` | `ValueId7` | `GENListValues` | `Id` | 108,215 | 3,328 |
| `GENPushNotifications` | `ValueId8` | `GENListValues` | `Id` | 108,215 | 3,328 |
| `GENPushNotifications` | `ValueId9` | `GENListValues` | `Id` | 108,215 | 3,328 |
| `GENPushNotifications` | `StatusId` | `GENStatus` | `Id` | 108,215 | 9 |
| `GENPushNotifications` | `IconId` | `GENStyles` | `Id` | 108,215 | 1,445 |
| `GENQuestionGroups` | `LanguageId` | `GENListValues` | `Id` | 3 | 3,328 |
| `GENQuestionGroups` | `ValueId1` | `GENListValues` | `Id` | 3 | 3,328 |
| `GENQuestionGroups` | `ValueId2` | `GENListValues` | `Id` | 3 | 3,328 |
| `GENQuestionGroups` | `ValueId3` | `GENListValues` | `Id` | 3 | 3,328 |
| `GENQuestionGroups` | `ValueId4` | `GENListValues` | `Id` | 3 | 3,328 |
| `GENQuestionGroups` | `ValueId5` | `GENListValues` | `Id` | 3 | 3,328 |
| `GENQuestionGroups` | `IconId` | `GENStyles` | `Id` | 3 | 1,445 |
| `GENRatings` | `UserId` | `AspNetUsers` | `Id` | 239,573 | 40,910 |
| `GENRatings` | `BaseEntityId` | `BaseEntities` | `Id` | 239,573 | 203 |
| `GENRatings` | `EmogyId` | `Emogies` | `Id` | 239,573 | 6 |
| `GENRawDataTypes` | `ValueId1` | `GENListValues` | `Id` | 2 | 3,328 |
| `GENRawDataTypes` | `ValueId2` | `GENListValues` | `Id` | 2 | 3,328 |
| `GENRawDataTypes` | `ValueId3` | `GENListValues` | `Id` | 2 | 3,328 |
| `GENRawDataTypes` | `ValueId4` | `GENListValues` | `Id` | 2 | 3,328 |
| `GENRawDataTypes` | `ValueId5` | `GENListValues` | `Id` | 2 | 3,328 |
| `GENRawDataTypes` | `IconId` | `GENStyles` | `Id` | 2 | 1,445 |
| `GENRawDatas` | `UserId` | `AspNetUsers` | `Id` | 0 | 40,910 |
| `GENRawDatas` | `BaseEntityId` | `BaseEntities` | `Id` | 0 | 203 |
| `GENRawDatas` | `ReasonId` | `CRMSRVReasons` | `Id` | 0 | 0 |
| `GENRawDatas` | `SourceId` | `CRMSources` | `Id` | 0 | 18 |
| `GENRawDatas` | `BranchId` | `GENBranches` | `Id` | 0 | 2 |
| `GENRawDatas` | `BrandId` | `GENBrands` | `Id` | 0 | 10 |
| `GENRawDatas` | `CompanyId` | `GENCompanies` | `Id` | 0 | 6,045 |
| `GENRawDatas` | `DepartmentId` | `GENDepartments` | `Id` | 0 | 6 |
| `GENRawDatas` | `AssessmentId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENRawDatas` | `GenderId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENRawDatas` | `LanguageId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENRawDatas` | `PriortyId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENRawDatas` | `RentPeriodId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENRawDatas` | `ValueId1` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENRawDatas` | `ValueId2` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENRawDatas` | `ValueId3` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENRawDatas` | `ValueId4` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENRawDatas` | `ValueId5` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENRawDatas` | `PaymentMethodId` | `GENPaymentMethods` | `Id` | 0 | 7 |
| `GENRawDatas` | `RawDataTypeId` | `GENRawDataTypes` | `Id` | 0 | 2 |
| `GENRawDatas` | `SalutationId` | `GENSalutations` | `Id` | 0 | 19 |
| `GENRawDatas` | `StatusId` | `GENStatus` | `Id` | 0 | 9 |
| `GENRawDatas` | `IconId` | `GENStyles` | `Id` | 0 | 1,445 |
| `GENRawDatas` | `TypeId` | `GENTypes` | `Id` | 0 | 416 |
| `GENRawDatas` | `RawDataCategoryId` | `RawDataCategories` | `Id` | 0 | 0 |
| `GENReacts` | `CreatedById` | `AspNetUsers` | `Id` | 0 | 40,910 |
| `GENReacts` | `LastUpdatedById` | `AspNetUsers` | `Id` | 0 | 40,910 |
| `GENReacts` | `UserId` | `AspNetUsers` | `Id` | 0 | 40,910 |
| `GENReacts` | `BaseEntityId` | `BaseEntities` | `Id` | 0 | 203 |
| `GENReacts` | `BlogId` | `GENBlogs` | `Id` | 0 | 1 |
| `GENRegionCategories` | `ValueId1` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENRegionCategories` | `ValueId2` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENRegionCategories` | `ValueId3` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENRegionCategories` | `ValueId4` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENRegionCategories` | `ValueId5` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENRegionCategories` | `IconId` | `GENStyles` | `Id` | 0 | 1,445 |
| `GENRegions` | `ValueId1` | `GENListValues` | `Id` | 8 | 3,328 |
| `GENRegions` | `ValueId2` | `GENListValues` | `Id` | 8 | 3,328 |
| `GENRegions` | `ValueId3` | `GENListValues` | `Id` | 8 | 3,328 |
| `GENRegions` | `ValueId4` | `GENListValues` | `Id` | 8 | 3,328 |
| `GENRegions` | `ValueId5` | `GENListValues` | `Id` | 8 | 3,328 |
| `GENRegions` | `IconId` | `GENStyles` | `Id` | 8 | 1,445 |
| `GENRegions1` | `CityId` | `GENCities` | `Id` | 0 | 28 |
| `GENRegions1` | `RegionCategoryId` | `GENRegionCategories` | `Id` | 0 | 0 |
| `GENRequestLocations` | `DeletedById` | `AspNetUsers` | `Id` | 0 | 40,910 |
| `GENRequestLocations` | `RequestId` | `GENRequests` | `Id` | 0 | 0 |
| `GENRequestLocations` | `GENStatusId` | `GENStatus` | `Id` | 0 | 9 |
| `GENRequestType_LOGStop` | `RequestTypeId` | `GENRequestTypes` | `Id` | 0 | 0 |
| `GENRequestType_LOGStop` | `RouteId` | `LOGRoutes` | `Id` | 0 | 0 |
| `GENRequestType_LOGStop` | `StopId` | `LOGStops` | `Id` | 0 | 0 |
| `GENRequestTypes` | `IconId` | `GENStyles` | `Id` | 0 | 1,445 |
| `GENRequests` | `CreatedById` | `AspNetUsers` | `Id` | 0 | 40,910 |
| `GENRequests` | `DeletedById` | `AspNetUsers` | `Id` | 0 | 40,910 |
| `GENRequests` | `LastUpdatedById` | `AspNetUsers` | `Id` | 0 | 40,910 |
| `GENRequests` | `UserId` | `AspNetUsers` | `Id` | 0 | 40,910 |
| `GENRequests` | `RequesterId` | `CRMSRVRequesters` | `Id` | 0 | 0 |
| `GENRequests` | `BulkRequstId` | `GENBulkRequests` | `Id` | 0 | 0 |
| `GENRequests` | `CompanyId` | `GENCompanies` | `Id` | 0 | 6,045 |
| `GENRequests` | `ContactId` | `GENContacts` | `Id` | 0 | 51,607 |
| `GENRequests` | `MainEmployeeId` | `GENEmployees` | `Id` | 0 | 824 |
| `GENRequests` | `PaymentMethodId` | `GENPaymentMethods` | `Id` | 0 | 7 |
| `GENRequests` | `RequestTypeId` | `GENRequestTypes` | `Id` | 0 | 0 |
| `GENRequests` | `GENStatusId` | `GENStatus` | `Id` | 0 | 9 |
| `GENRequests` | `IconId` | `GENStyles` | `Id` | 0 | 1,445 |
| `GENRequests` | `VehicleId` | `GENVehicles` | `Id` | 0 | 0 |
| `GENRequests` | `RouteId` | `LOGRoutes` | `Id` | 0 | 0 |
| `GENRequests` | `StopId` | `LOGStops` | `Id` | 0 | 0 |
| `GENReturnedOrders` | `OrderId` | `GENOrders` | `Id` | 67 | 3,701 |
| `GENReviews` | `UserId` | `AspNetUsers` | `Id` | 0 | 40,910 |
| `GENReviews` | `BaseEntityId` | `BaseEntities` | `Id` | 0 | 203 |
| `GENRooms` | `IconId` | `GENStyles` | `Id` | 47 | 1,445 |
| `GENSalutationCategories` | `ValueId1` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENSalutationCategories` | `ValueId2` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENSalutationCategories` | `ValueId3` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENSalutationCategories` | `ValueId4` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENSalutationCategories` | `ValueId5` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENSalutationCategories` | `IconId` | `GENStyles` | `Id` | 0 | 1,445 |
| `GENSalutations` | `ValueId1` | `GENListValues` | `Id` | 19 | 3,328 |
| `GENSalutations` | `ValueId2` | `GENListValues` | `Id` | 19 | 3,328 |
| `GENSalutations` | `ValueId3` | `GENListValues` | `Id` | 19 | 3,328 |
| `GENSalutations` | `ValueId4` | `GENListValues` | `Id` | 19 | 3,328 |
| `GENSalutations` | `ValueId5` | `GENListValues` | `Id` | 19 | 3,328 |
| `GENSalutations` | `SalutationCategoryId` | `GENSalutationCategories` | `Id` | 19 | 0 |
| `GENSalutations` | `IconId` | `GENStyles` | `Id` | 19 | 1,445 |
| `GENSchedulers` | `BaseEntityId` | `BaseEntities` | `Id` | 0 | 203 |
| `GENSchedulers` | `ActionTypeId` | `GENCommentTypes` | `Id` | 0 | 7 |
| `GENSchedulers` | `ListValueId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENSchedulers` | `RepeatPeriodId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENSchedulers` | `ValueId1` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENSchedulers` | `ValueId2` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENSchedulers` | `ValueId3` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENSchedulers` | `ValueId4` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENSchedulers` | `ValueId5` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENSchedulers` | `IconId` | `GENStyles` | `Id` | 0 | 1,445 |
| `GENSectionCategories` | `ValueId1` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENSectionCategories` | `ValueId2` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENSectionCategories` | `ValueId3` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENSectionCategories` | `ValueId4` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENSectionCategories` | `ValueId5` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENSectionCategories` | `IconId` | `GENStyles` | `Id` | 0 | 1,445 |
| `GENSection_Wiki` | `SectionId` | `GENSections` | `Id` | 0 | 2 |
| `GENSection_Wiki` | `WikiId` | `GENWikis` | `Id` | 0 | 648 |
| `GENSections` | `BrandId` | `GENBrands` | `Id` | 2 | 10 |
| `GENSections` | `ItemCategoryId` | `GENItemCategories` | `Id` | 2 | 3 |
| `GENSections` | `ItemId` | `GENItems` | `Id` | 2 | 5,180 |
| `GENSections` | `ValueId1` | `GENListValues` | `Id` | 2 | 3,328 |
| `GENSections` | `ValueId2` | `GENListValues` | `Id` | 2 | 3,328 |
| `GENSections` | `ValueId3` | `GENListValues` | `Id` | 2 | 3,328 |
| `GENSections` | `ValueId4` | `GENListValues` | `Id` | 2 | 3,328 |
| `GENSections` | `ValueId5` | `GENListValues` | `Id` | 2 | 3,328 |
| `GENSections` | `SectionCategoryId` | `GENSectionCategories` | `Id` | 2 | 0 |
| `GENSections` | `IconId` | `GENStyles` | `Id` | 2 | 1,445 |
| `GENServiceCategories` | `ValueId1` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENServiceCategories` | `ValueId2` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENServiceCategories` | `ValueId3` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENServiceCategories` | `ValueId4` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENServiceCategories` | `ValueId5` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENServiceCategories` | `IconId` | `GENStyles` | `Id` | 0 | 1,445 |
| `GENServices` | `ValueId1` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENServices` | `ValueId2` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENServices` | `ValueId3` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENServices` | `ValueId4` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENServices` | `ValueId5` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENServices` | `ServiceCategoryId` | `GENServiceCategories` | `Id` | 0 | 0 |
| `GENServices` | `IconId` | `GENStyles` | `Id` | 0 | 1,445 |
| `GENSpecificationGroups` | `ValueId1` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENSpecificationGroups` | `ValueId2` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENSpecificationGroups` | `ValueId3` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENSpecificationGroups` | `ValueId4` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENSpecificationGroups` | `ValueId5` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENSpecificationGroups` | `IconId` | `GENStyles` | `Id` | 0 | 1,445 |
| `GENSpecifications` | `ValueId1` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENSpecifications` | `ValueId2` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENSpecifications` | `ValueId3` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENSpecifications` | `ValueId4` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENSpecifications` | `ValueId5` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENSpecifications` | `SpecificationGroupId` | `GENSpecificationGroups` | `Id` | 0 | 0 |
| `GENSpecifications` | `IconId` | `GENStyles` | `Id` | 0 | 1,445 |
| `GENStatus` | `ValueId1` | `GENListValues` | `Id` | 9 | 3,328 |
| `GENStatus` | `ValueId2` | `GENListValues` | `Id` | 9 | 3,328 |
| `GENStatus` | `ValueId3` | `GENListValues` | `Id` | 9 | 3,328 |
| `GENStatus` | `ValueId4` | `GENListValues` | `Id` | 9 | 3,328 |
| `GENStatus` | `ValueId5` | `GENListValues` | `Id` | 9 | 3,328 |
| `GENStatus` | `GENListValuesTypeId` | `GENListValuesTypes` | `Id` | 9 | 50 |
| `GENStatus` | `ExitActionStatusId` | `GENStatus` | `Id` | 9 | 9 |
| `GENStatus` | `listOfActionId` | `ListOfActions` | `Id` | 9 | 0 |
| `GENStatusBaseEntities` | `BaseEntity_Id` | `BaseEntities` | `Id` | 0 | 203 |
| `GENStatusBaseEntities` | `GENStatus_Id` | `GENStatus` | `Id` | 0 | 9 |
| `GENStatusMessageCategories` | `ValueId1` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENStatusMessageCategories` | `ValueId2` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENStatusMessageCategories` | `ValueId3` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENStatusMessageCategories` | `ValueId4` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENStatusMessageCategories` | `ValueId5` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENStatusMessageCategories` | `IconId` | `GENStyles` | `Id` | 0 | 1,445 |
| `GENStatusMessages` | `ValueId1` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENStatusMessages` | `ValueId2` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENStatusMessages` | `ValueId3` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENStatusMessages` | `ValueId4` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENStatusMessages` | `ValueId5` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENStatusMessages` | `StatusMessageCategoryId` | `GENStatusMessageCategories` | `Id` | 0 | 0 |
| `GENStatusMessages` | `IconId` | `GENStyles` | `Id` | 0 | 1,445 |
| `GENTCRs` | `DealTypeId` | `CRMDealTypes` | `Id` | 0 | 2 |
| `GENTCRs` | `DealId` | `CRMDeals` | `Id` | 0 | 0 |
| `GENTCRs` | `QuoteId` | `CRMQuotes` | `Id` | 0 | 0 |
| `GENTCRs` | `ReasonId` | `CRMSRVReasons` | `Id` | 0 | 0 |
| `GENTCRs` | `SourceId` | `CRMSources` | `Id` | 0 | 18 |
| `GENTCRs` | `BranchId` | `GENBranches` | `Id` | 0 | 2 |
| `GENTCRs` | `BrandId` | `GENBrands` | `Id` | 0 | 10 |
| `GENTCRs` | `DealCompanyId` | `GENCompanies` | `Id` | 0 | 6,045 |
| `GENTCRs` | `ContactId` | `GENContacts` | `Id` | 0 | 51,607 |
| `GENTCRs` | `DealContactId` | `GENContacts` | `Id` | 0 | 51,607 |
| `GENTCRs` | `DealCurrencyId` | `GENCurrencies` | `Id` | 0 | 2 |
| `GENTCRs` | `DealResponsiblePersonId` | `GENEmployees` | `Id` | 0 | 824 |
| `GENTCRs` | `EmployeeId` | `GENEmployees` | `Id` | 0 | 824 |
| `GENTCRs` | `AssessmentId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENTCRs` | `PriortyId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENTCRs` | `RentPeriodId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENTCRs` | `TCRTypeId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENTCRs` | `ValueId1` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENTCRs` | `ValueId2` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENTCRs` | `ValueId3` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENTCRs` | `ValueId4` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENTCRs` | `ValueId5` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENTCRs` | `PaymentMethodId` | `GENPaymentMethods` | `Id` | 0 | 7 |
| `GENTCRs` | `StatusId` | `GENStatus` | `Id` | 0 | 9 |
| `GENTCRs` | `IconId` | `GENStyles` | `Id` | 0 | 1,445 |
| `GENTCRs` | `TypeId` | `GENTypes` | `Id` | 0 | 416 |
| `GENTagCategories` | `CreatedById` | `AspNetUsers` | `Id` | 1 | 40,910 |
| `GENTagCategories` | `LastUpdatedById` | `AspNetUsers` | `Id` | 1 | 40,910 |
| `GENTags` | `ValueId1` | `GENListValues` | `Id` | 1 | 3,328 |
| `GENTags` | `ValueId2` | `GENListValues` | `Id` | 1 | 3,328 |
| `GENTags` | `ValueId3` | `GENListValues` | `Id` | 1 | 3,328 |
| `GENTags` | `ValueId4` | `GENListValues` | `Id` | 1 | 3,328 |
| `GENTags` | `ValueId5` | `GENListValues` | `Id` | 1 | 3,328 |
| `GENTags` | `IconId` | `GENStyles` | `Id` | 1 | 1,445 |
| `GENTags` | `TagCategoryId` | `GENTagCategories` | `Id` | 1 | 1 |
| `GENTalentBuilders` | `DeletedById` | `AspNetUsers` | `Id` | 40 | 40,910 |
| `GENTalentBuilders` | `ValueId1` | `GENListValues` | `Id` | 40 | 3,328 |
| `GENTalentBuilders` | `ValueId2` | `GENListValues` | `Id` | 40 | 3,328 |
| `GENTalentBuilders` | `ValueId3` | `GENListValues` | `Id` | 40 | 3,328 |
| `GENTalentBuilders` | `ValueId4` | `GENListValues` | `Id` | 40 | 3,328 |
| `GENTalentBuilders` | `ValueId5` | `GENListValues` | `Id` | 40 | 3,328 |
| `GENTalentBuilders` | `IconId` | `GENStyles` | `Id` | 40 | 1,445 |
| `GENTalents` | `DeletedById` | `AspNetUsers` | `Id` | 108 | 40,910 |
| `GENTalents` | `ValueId1` | `GENListValues` | `Id` | 108 | 3,328 |
| `GENTalents` | `ValueId2` | `GENListValues` | `Id` | 108 | 3,328 |
| `GENTalents` | `ValueId3` | `GENListValues` | `Id` | 108 | 3,328 |
| `GENTalents` | `ValueId4` | `GENListValues` | `Id` | 108 | 3,328 |
| `GENTalents` | `ValueId5` | `GENListValues` | `Id` | 108 | 3,328 |
| `GENTalents` | `IconId` | `GENStyles` | `Id` | 108 | 1,445 |
| `GENTalents` | `TalentBuilderId` | `GENTalentBuilders` | `Id` | 108 | 40 |
| `GENTalents_Generic` | `VcrId` | `GENClassrooms` | `Id` | 921 | 2,996 |
| `GENTalents_Generic` | `TalentId` | `GENTalents` | `Id` | 921 | 108 |
| `GENTranslate_AddressZone` | `BaseEntityFieldId` | `BaseEntityFields` | `Id` | 0 | 7,185 |
| `GENTranslate_AddressZone` | `AddressZoneId` | `GENAddressZones` | `Id` | 0 | 0 |
| `GENTranslate_AddressZone` | `LangId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENTranslate_AddressZone` | `FieldId` | `PageOfPageFeilds` | `Id` | 0 | 39,925 |
| `GENTranslate_Area` | `BaseEntityFieldId` | `BaseEntityFields` | `Id` | 0 | 7,185 |
| `GENTranslate_Area` | `AreaId` | `GENAreas` | `Id` | 0 | 0 |
| `GENTranslate_Area` | `LangId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENTranslate_Area` | `FieldId` | `PageOfPageFeilds` | `Id` | 0 | 39,925 |
| `GENTranslate_BackGroundImage` | `BaseEntityFieldId` | `BaseEntityFields` | `Id` | 0 | 7,185 |
| `GENTranslate_BackGroundImage` | `BackgroundimageId` | `GENBackgroundImages` | `Id` | 0 | 0 |
| `GENTranslate_BackGroundImage` | `LangId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENTranslate_BackGroundImage` | `FieldId` | `PageOfPageFeilds` | `Id` | 0 | 39,925 |
| `GENTranslate_BackendPage` | `BackendPageId` | `GENBackendPages` | `Id` | 352 | 261 |
| `GENTranslate_BackendPage` | `LangId` | `GENListValues` | `Id` | 352 | 3,328 |
| `GENTranslate_BackendPage` | `FieldId` | `PageOfPageFeilds` | `Id` | 352 | 39,925 |
| `GENTranslate_BackendPageSection` | `BaseEntityFieldId` | `BaseEntityFields` | `Id` | 40 | 7,185 |
| `GENTranslate_BackendPageSection` | `BackendPageSectionId` | `GENBackendPageSections` | `Id` | 40 | 54 |
| `GENTranslate_BackendPageSection` | `LangId` | `GENListValues` | `Id` | 40 | 3,328 |
| `GENTranslate_BackendPageSection` | `FieldId` | `PageOfPageFeilds` | `Id` | 40 | 39,925 |
| `GENTranslate_BackendPageSectionCategory` | `BaseEntityFieldId` | `BaseEntityFields` | `Id` | 0 | 7,185 |
| `GENTranslate_BackendPageSectionCategory` | `BackendPageSectionCategoryId` | `GENBackendPageSectionCategories` | `Id` | 0 | 6 |
| `GENTranslate_BackendPageSectionCategory` | `LangId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENTranslate_BackendPageSectionCategory` | `FieldId` | `PageOfPageFeilds` | `Id` | 0 | 39,925 |
| `GENTranslate_Branch` | `BaseEntityFieldId` | `BaseEntityFields` | `Id` | 0 | 7,185 |
| `GENTranslate_Branch` | `BranchId` | `GENBranches` | `Id` | 0 | 2 |
| `GENTranslate_Branch` | `LangId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENTranslate_Branch` | `FieldId` | `PageOfPageFeilds` | `Id` | 0 | 39,925 |
| `GENTranslate_BranchType` | `BaseEntityFieldId` | `BaseEntityFields` | `Id` | 0 | 7,185 |
| `GENTranslate_BranchType` | `BranchTypeId` | `GENBranchTypes` | `Id` | 0 | 2 |
| `GENTranslate_BranchType` | `LangId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENTranslate_BranchType` | `FieldId` | `PageOfPageFeilds` | `Id` | 0 | 39,925 |
| `GENTranslate_Brand` | `BaseEntityFieldId` | `BaseEntityFields` | `Id` | 0 | 7,185 |
| `GENTranslate_Brand` | `BrandId` | `GENBrands` | `Id` | 0 | 10 |
| `GENTranslate_Brand` | `LangId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENTranslate_Brand` | `FieldId` | `PageOfPageFeilds` | `Id` | 0 | 39,925 |
| `GENTranslate_BrandCategory` | `BaseEntityFieldId` | `BaseEntityFields` | `Id` | 0 | 7,185 |
| `GENTranslate_BrandCategory` | `BrandCategoryId` | `GENBrandCategories` | `Id` | 0 | 0 |
| `GENTranslate_BrandCategory` | `LangId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENTranslate_BrandCategory` | `FieldId` | `PageOfPageFeilds` | `Id` | 0 | 39,925 |
| `GENTranslate_BranshCategory` | `BaseEntityFieldId` | `BaseEntityFields` | `Id` | 0 | 7,185 |
| `GENTranslate_BranshCategory` | `BranchCategoryId` | `GENBranchCategories` | `Id` | 0 | 0 |
| `GENTranslate_BranshCategory` | `LangId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENTranslate_BranshCategory` | `FieldId` | `PageOfPageFeilds` | `Id` | 0 | 39,925 |
| `GENTranslate_BulkPushNotification` | `BaseEntityFieldId` | `BaseEntityFields` | `Id` | 0 | 7,185 |
| `GENTranslate_BulkPushNotification` | `BulkPushNotificationId` | `GENBulkPushNotifications` | `Id` | 0 | 0 |
| `GENTranslate_BulkPushNotification` | `LangId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENTranslate_BulkPushNotification` | `FieldId` | `PageOfPageFeilds` | `Id` | 0 | 39,925 |
| `GENTranslate_City` | `BaseEntityFieldId` | `BaseEntityFields` | `Id` | 56 | 7,185 |
| `GENTranslate_City` | `CityId` | `GENCities` | `Id` | 56 | 28 |
| `GENTranslate_City` | `LangId` | `GENListValues` | `Id` | 56 | 3,328 |
| `GENTranslate_City` | `FieldId` | `PageOfPageFeilds` | `Id` | 56 | 39,925 |
| `GENTranslate_ClassRoom` | `BaseEntityFieldId` | `BaseEntityFields` | `Id` | 0 | 7,185 |
| `GENTranslate_ClassRoom` | `ClassRoomId` | `GENClassrooms` | `Id` | 0 | 2,996 |
| `GENTranslate_ClassRoom` | `LangId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENTranslate_ClassRoom` | `FieldId` | `PageOfPageFeilds` | `Id` | 0 | 39,925 |
| `GENTranslate_Classification` | `BaseEntityFieldId` | `BaseEntityFields` | `Id` | 0 | 7,185 |
| `GENTranslate_Classification` | `ClassificationId` | `GENClassifications` | `Id` | 0 | 2 |
| `GENTranslate_Classification` | `LangId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENTranslate_Classification` | `FieldId` | `PageOfPageFeilds` | `Id` | 0 | 39,925 |
| `GENTranslate_ClassificationCategory` | `BaseEntityFieldId` | `BaseEntityFields` | `Id` | 0 | 7,185 |
| `GENTranslate_ClassificationCategory` | `ClassificationCategoryId` | `GENClassificationCategories` | `Id` | 0 | 0 |
| `GENTranslate_ClassificationCategory` | `LangId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENTranslate_ClassificationCategory` | `FieldId` | `PageOfPageFeilds` | `Id` | 0 | 39,925 |
| `GENTranslate_CommentType` | `BaseEntityFieldId` | `BaseEntityFields` | `Id` | 0 | 7,185 |
| `GENTranslate_CommentType` | `CommentTypeId` | `GENCommentTypes` | `Id` | 0 | 7 |
| `GENTranslate_CommentType` | `LangId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENTranslate_CommentType` | `FieldId` | `PageOfPageFeilds` | `Id` | 0 | 39,925 |
| `GENTranslate_Company` | `BaseEntityFieldId` | `BaseEntityFields` | `Id` | 0 | 7,185 |
| `GENTranslate_Company` | `CompanyId` | `GENCompanies` | `Id` | 0 | 6,045 |
| `GENTranslate_Company` | `LangId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENTranslate_Company` | `FieldId` | `PageOfPageFeilds` | `Id` | 0 | 39,925 |
| `GENTranslate_CompanyType` | `BaseEntityFieldId` | `BaseEntityFields` | `Id` | 0 | 7,185 |
| `GENTranslate_CompanyType` | `GENCompanyTypeId` | `GENCompanyTypes` | `Id` | 0 | 11 |
| `GENTranslate_CompanyType` | `LangId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENTranslate_CompanyType` | `FieldId` | `PageOfPageFeilds` | `Id` | 0 | 39,925 |
| `GENTranslate_Configuration` | `BaseEntityFieldId` | `BaseEntityFields` | `Id` | 0 | 7,185 |
| `GENTranslate_Configuration` | `ConfigurationId` | `GENConfigurations` | `Id` | 0 | 174 |
| `GENTranslate_Configuration` | `LangId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENTranslate_Configuration` | `FieldId` | `PageOfPageFeilds` | `Id` | 0 | 39,925 |
| `GENTranslate_ConfigurationCategory` | `BaseEntityFieldId` | `BaseEntityFields` | `Id` | 0 | 7,185 |
| `GENTranslate_ConfigurationCategory` | `ConfigurationCategoryId` | `GENConfigurationCategories` | `Id` | 0 | 5 |
| `GENTranslate_ConfigurationCategory` | `LangId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENTranslate_ConfigurationCategory` | `FieldId` | `PageOfPageFeilds` | `Id` | 0 | 39,925 |
| `GENTranslate_Contact` | `BaseEntityFieldId` | `BaseEntityFields` | `Id` | 0 | 7,185 |
| `GENTranslate_Contact` | `ContactId` | `GENContacts` | `Id` | 0 | 51,607 |
| `GENTranslate_Contact` | `LangId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENTranslate_Contact` | `FieldId` | `PageOfPageFeilds` | `Id` | 0 | 39,925 |
| `GENTranslate_ContactCategory` | `BaseEntityFieldId` | `BaseEntityFields` | `Id` | 0 | 7,185 |
| `GENTranslate_ContactCategory` | `ContactCategoryId` | `GENContactCategories` | `Id` | 0 | 3 |
| `GENTranslate_ContactCategory` | `LangId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENTranslate_ContactCategory` | `FieldId` | `PageOfPageFeilds` | `Id` | 0 | 39,925 |
| `GENTranslate_ContactType` | `BaseEntityFieldId` | `BaseEntityFields` | `Id` | 0 | 7,185 |
| `GENTranslate_ContactType` | `ContactTypeId` | `GENContactTypes` | `Id` | 0 | 4 |
| `GENTranslate_ContactType` | `LangId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENTranslate_ContactType` | `FieldId` | `PageOfPageFeilds` | `Id` | 0 | 39,925 |
| `GENTranslate_Country` | `BaseEntityFieldId` | `BaseEntityFields` | `Id` | 367 | 7,185 |
| `GENTranslate_Country` | `CountryId` | `GENCountries` | `Id` | 367 | 174 |
| `GENTranslate_Country` | `LangId` | `GENListValues` | `Id` | 367 | 3,328 |
| `GENTranslate_Country` | `FieldId` | `PageOfPageFeilds` | `Id` | 367 | 39,925 |
| `GENTranslate_Currency` | `BaseEntityFieldId` | `BaseEntityFields` | `Id` | 0 | 7,185 |
| `GENTranslate_Currency` | `CurrencyId` | `GENCurrencies` | `Id` | 0 | 2 |
| `GENTranslate_Currency` | `LangId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENTranslate_Currency` | `CurrencyId` | `GENUnits` | `Id` | 0 | 1 |
| `GENTranslate_Currency` | `FieldId` | `PageOfPageFeilds` | `Id` | 0 | 39,925 |
| `GENTranslate_DealType` | `BaseEntityFieldId` | `BaseEntityFields` | `Id` | 0 | 7,185 |
| `GENTranslate_DealType` | `DealTypeId` | `CRMDealTypes` | `Id` | 0 | 2 |
| `GENTranslate_DealType` | `LangId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENTranslate_DealType` | `FieldId` | `PageOfPageFeilds` | `Id` | 0 | 39,925 |
| `GENTranslate_Department` | `BaseEntityFieldId` | `BaseEntityFields` | `Id` | 0 | 7,185 |
| `GENTranslate_Department` | `DepartmentId` | `GENDepartments` | `Id` | 0 | 6 |
| `GENTranslate_Department` | `LangId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENTranslate_Department` | `FieldId` | `PageOfPageFeilds` | `Id` | 0 | 39,925 |
| `GENTranslate_Discount` | `BaseEntityFieldId` | `BaseEntityFields` | `Id` | 0 | 7,185 |
| `GENTranslate_Discount` | `DiscountId` | `GENDiscounts` | `Id` | 0 | 0 |
| `GENTranslate_Discount` | `LangId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENTranslate_Discount` | `FieldId` | `PageOfPageFeilds` | `Id` | 0 | 39,925 |
| `GENTranslate_DiscountCategory` | `BaseEntityFieldId` | `BaseEntityFields` | `Id` | 0 | 7,185 |
| `GENTranslate_DiscountCategory` | `DiscountCategoryId` | `GENDiscountCategories` | `Id` | 0 | 0 |
| `GENTranslate_DiscountCategory` | `LangId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENTranslate_DiscountCategory` | `FieldId` | `PageOfPageFeilds` | `Id` | 0 | 39,925 |
| `GENTranslate_District` | `BaseEntityFieldId` | `BaseEntityFields` | `Id` | 0 | 7,185 |
| `GENTranslate_District` | `DistrictId` | `GENDistricts` | `Id` | 0 | 9 |
| `GENTranslate_District` | `LangId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENTranslate_District` | `FieldId` | `PageOfPageFeilds` | `Id` | 0 | 39,925 |
| `GENTranslate_EasyAccess` | `BaseEntityFieldId` | `BaseEntityFields` | `Id` | 0 | 7,185 |
| `GENTranslate_EasyAccess` | `EasyAccessId` | `GENEasyAccesses` | `Id` | 0 | 57 |
| `GENTranslate_EasyAccess` | `LangId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENTranslate_EasyAccess` | `FieldId` | `PageOfPageFeilds` | `Id` | 0 | 39,925 |
| `GENTranslate_EmailType` | `BaseEntityFieldId` | `BaseEntityFields` | `Id` | 0 | 7,185 |
| `GENTranslate_EmailType` | `EmailTypeId` | `GENEmailTypes` | `Id` | 0 | 1 |
| `GENTranslate_EmailType` | `LangId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENTranslate_EmailType` | `FieldId` | `PageOfPageFeilds` | `Id` | 0 | 39,925 |
| `GENTranslate_Employee` | `BaseEntityFieldId` | `BaseEntityFields` | `Id` | 0 | 7,185 |
| `GENTranslate_Employee` | `EmployeeId` | `GENEmployees` | `Id` | 0 | 824 |
| `GENTranslate_Employee` | `LangId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENTranslate_Employee` | `FieldId` | `PageOfPageFeilds` | `Id` | 0 | 39,925 |
| `GENTranslate_EmployeeCategory` | `BaseEntityFieldId` | `BaseEntityFields` | `Id` | 0 | 7,185 |
| `GENTranslate_EmployeeCategory` | `EmployeeCategoryId` | `GENEmployeeCategories` | `Id` | 0 | 2 |
| `GENTranslate_EmployeeCategory` | `LangId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENTranslate_EmployeeCategory` | `FieldId` | `PageOfPageFeilds` | `Id` | 0 | 39,925 |
| `GENTranslate_EmployeeType` | `BaseEntityFieldId` | `BaseEntityFields` | `Id` | 0 | 7,185 |
| `GENTranslate_EmployeeType` | `GENEmployeeTypeId` | `GENEmployeeTypes` | `Id` | 0 | 2 |
| `GENTranslate_EmployeeType` | `LangId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENTranslate_EmployeeType` | `FieldId` | `PageOfPageFeilds` | `Id` | 0 | 39,925 |
| `GENTranslate_FeedBack` | `BaseEntityFieldId` | `BaseEntityFields` | `Id` | 0 | 7,185 |
| `GENTranslate_FeedBack` | `FeedBackId` | `GENFeedBacks` | `Id` | 0 | 10,810 |
| `GENTranslate_FeedBack` | `LangId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENTranslate_FeedBack` | `FieldId` | `PageOfPageFeilds` | `Id` | 0 | 39,925 |
| `GENTranslate_FeedBackCategory` | `BaseEntityFieldId` | `BaseEntityFields` | `Id` | 0 | 7,185 |
| `GENTranslate_FeedBackCategory` | `FeedBackCategoryId` | `GENFeedBackCategories` | `Id` | 0 | 9 |
| `GENTranslate_FeedBackCategory` | `LangId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENTranslate_FeedBackCategory` | `FieldId` | `PageOfPageFeilds` | `Id` | 0 | 39,925 |
| `GENTranslate_FileAttachment` | `BaseEntityFieldId` | `BaseEntityFields` | `Id` | 0 | 7,185 |
| `GENTranslate_FileAttachment` | `FileAttachId` | `GENFileAttachments` | `Id` | 0 | 0 |
| `GENTranslate_FileAttachment` | `LangId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENTranslate_FileAttachment` | `FieldId` | `PageOfPageFeilds` | `Id` | 0 | 39,925 |
| `GENTranslate_GENTalent` | `BaseEntityFieldId` | `BaseEntityFields` | `Id` | 0 | 7,185 |
| `GENTranslate_GENTalent` | `LangId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENTranslate_GENTalent` | `TalentId` | `GENTalents` | `Id` | 0 | 108 |
| `GENTranslate_GENTalent` | `FieldId` | `PageOfPageFeilds` | `Id` | 0 | 39,925 |
| `GENTranslate_GENTalentBuilder` | `BaseEntityFieldId` | `BaseEntityFields` | `Id` | 0 | 7,185 |
| `GENTranslate_GENTalentBuilder` | `LangId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENTranslate_GENTalentBuilder` | `TalentBuilderId` | `GENTalentBuilders` | `Id` | 0 | 40 |
| `GENTranslate_GENTalentBuilder` | `FieldId` | `PageOfPageFeilds` | `Id` | 0 | 39,925 |
| `GENTranslate_GalleryAlbum` | `BaseEntityFieldId` | `BaseEntityFields` | `Id` | 0 | 7,185 |
| `GENTranslate_GalleryAlbum` | `GalleryAlbumId` | `GENGalleryAlbums` | `Id` | 0 | 0 |
| `GENTranslate_GalleryAlbum` | `LangId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENTranslate_GalleryAlbum` | `FieldId` | `PageOfPageFeilds` | `Id` | 0 | 39,925 |
| `GENTranslate_GalleryAlbumCategory` | `BaseEntityFieldId` | `BaseEntityFields` | `Id` | 0 | 7,185 |
| `GENTranslate_GalleryAlbumCategory` | `GalleryAlbumCategoryId` | `GENGalleryAlbumCategories` | `Id` | 0 | 0 |
| `GENTranslate_GalleryAlbumCategory` | `LangId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENTranslate_GalleryAlbumCategory` | `FieldId` | `PageOfPageFeilds` | `Id` | 0 | 39,925 |
| `GENTranslate_Governorate` | `BaseEntityFieldId` | `BaseEntityFields` | `Id` | 0 | 7,185 |
| `GENTranslate_Governorate` | `GovernorateId` | `GENGovernorates` | `Id` | 0 | 9 |
| `GENTranslate_Governorate` | `LangId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENTranslate_Governorate` | `FieldId` | `PageOfPageFeilds` | `Id` | 0 | 39,925 |
| `GENTranslate_HomeSlider` | `BaseEntityFieldId` | `BaseEntityFields` | `Id` | 2 | 7,185 |
| `GENTranslate_HomeSlider` | `HomeSliderId` | `GENHomeSliders` | `Id` | 2 | 6 |
| `GENTranslate_HomeSlider` | `LangId` | `GENListValues` | `Id` | 2 | 3,328 |
| `GENTranslate_HomeSlider` | `FieldId` | `PageOfPageFeilds` | `Id` | 2 | 39,925 |
| `GENTranslate_HomeSliderCategory` | `BaseEntityFieldId` | `BaseEntityFields` | `Id` | 0 | 7,185 |
| `GENTranslate_HomeSliderCategory` | `HomesliderCategoryId` | `GENHomeSliderCategories` | `Id` | 0 | 0 |
| `GENTranslate_HomeSliderCategory` | `LangId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENTranslate_HomeSliderCategory` | `FieldId` | `PageOfPageFeilds` | `Id` | 0 | 39,925 |
| `GENTranslate_ImageType` | `BaseEntityFieldId` | `BaseEntityFields` | `Id` | 0 | 7,185 |
| `GENTranslate_ImageType` | `ImageTypeId` | `GENImageTypes` | `Id` | 0 | 95 |
| `GENTranslate_ImageType` | `LangId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENTranslate_ImageType` | `FieldId` | `PageOfPageFeilds` | `Id` | 0 | 39,925 |
| `GENTranslate_Industry` | `BaseEntityFieldId` | `BaseEntityFields` | `Id` | 0 | 7,185 |
| `GENTranslate_Industry` | `GENIndustryId` | `GENIndustries` | `Id` | 0 | 25 |
| `GENTranslate_Industry` | `LangId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENTranslate_Industry` | `FieldId` | `PageOfPageFeilds` | `Id` | 0 | 39,925 |
| `GENTranslate_IndustryCategory` | `BaseEntityFieldId` | `BaseEntityFields` | `Id` | 0 | 7,185 |
| `GENTranslate_IndustryCategory` | `GENIndustryCategoryId` | `GENIndustryCategories` | `Id` | 0 | 0 |
| `GENTranslate_IndustryCategory` | `LangId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENTranslate_IndustryCategory` | `FieldId` | `PageOfPageFeilds` | `Id` | 0 | 39,925 |
| `GENTranslate_Issue` | `BaseEntityFieldId` | `BaseEntityFields` | `Id` | 0 | 7,185 |
| `GENTranslate_Issue` | `IssueId` | `CRMSRVIssues` | `Id` | 0 | 0 |
| `GENTranslate_Issue` | `LangId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENTranslate_Issue` | `FieldId` | `PageOfPageFeilds` | `Id` | 0 | 39,925 |
| `GENTranslate_IssueType` | `BaseEntityFieldId` | `BaseEntityFields` | `Id` | 0 | 7,185 |
| `GENTranslate_IssueType` | `IssueTypeId` | `CRMSRVIssueTypes` | `Id` | 0 | 0 |
| `GENTranslate_IssueType` | `LangId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENTranslate_IssueType` | `FieldId` | `PageOfPageFeilds` | `Id` | 0 | 39,925 |
| `GENTranslate_ItemCategories` | `BaseEntityFieldId` | `BaseEntityFields` | `Id` | 0 | 7,185 |
| `GENTranslate_ItemCategories` | `CategoryId` | `GENItemCategories` | `Id` | 0 | 3 |
| `GENTranslate_ItemCategories` | `LangId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENTranslate_ItemCategories` | `FieldId` | `PageOfPageFeilds` | `Id` | 0 | 39,925 |
| `GENTranslate_Item_Specification` | `BaseEntityFieldId` | `BaseEntityFields` | `Id` | 0 | 7,185 |
| `GENTranslate_Item_Specification` | `Item_SpecificationId` | `GENItem_Specification` | `Id` | 0 | 0 |
| `GENTranslate_Item_Specification` | `LangId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENTranslate_Item_Specification` | `FieldId` | `PageOfPageFeilds` | `Id` | 0 | 39,925 |
| `GENTranslate_Items` | `BaseEntityFieldId` | `BaseEntityFields` | `Id` | 0 | 7,185 |
| `GENTranslate_Items` | `ItemId` | `GENItems` | `Id` | 0 | 5,180 |
| `GENTranslate_Items` | `LangId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENTranslate_Items` | `FieldId` | `PageOfPageFeilds` | `Id` | 0 | 39,925 |
| `GENTranslate_ListValue` | `BaseEntityFieldId` | `BaseEntityFields` | `Id` | 131 | 7,185 |
| `GENTranslate_ListValue` | `GENListValuesId` | `GENListValues` | `Id` | 131 | 3,328 |
| `GENTranslate_ListValue` | `LangId` | `GENListValues` | `Id` | 131 | 3,328 |
| `GENTranslate_ListValue` | `FieldId` | `PageOfPageFeilds` | `Id` | 131 | 39,925 |
| `GENTranslate_ListValueType` | `BaseEntityFieldId` | `BaseEntityFields` | `Id` | 0 | 7,185 |
| `GENTranslate_ListValueType` | `LangId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENTranslate_ListValueType` | `GENListValuesTypeId` | `GENListValuesTypes` | `Id` | 0 | 50 |
| `GENTranslate_ListValueType` | `FieldId` | `PageOfPageFeilds` | `Id` | 0 | 39,925 |
| `GENTranslate_MaintenanceRole` | `BaseEntityFieldId` | `BaseEntityFields` | `Id` | 0 | 7,185 |
| `GENTranslate_MaintenanceRole` | `MaintenanceRoleId` | `CRMSRVMaintenanceRoles` | `Id` | 0 | 0 |
| `GENTranslate_MaintenanceRole` | `LangId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENTranslate_MaintenanceRole` | `FieldId` | `PageOfPageFeilds` | `Id` | 0 | 39,925 |
| `GENTranslate_MaintenanceRoleCategory` | `BaseEntityFieldId` | `BaseEntityFields` | `Id` | 0 | 7,185 |
| `GENTranslate_MaintenanceRoleCategory` | `MaintenanceRoleCategoryId` | `CRMSRVMaintenanceRoleCategories` | `Id` | 0 | 0 |
| `GENTranslate_MaintenanceRoleCategory` | `LangId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENTranslate_MaintenanceRoleCategory` | `FieldId` | `PageOfPageFeilds` | `Id` | 0 | 39,925 |
| `GENTranslate_MessagePushNotifications` | `BaseEntityFieldId` | `BaseEntityFields` | `Id` | 0 | 7,185 |
| `GENTranslate_MessagePushNotifications` | `LangId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENTranslate_MessagePushNotifications` | `MessagePushId` | `GENMessagesPushNotifications` | `Id` | 0 | 0 |
| `GENTranslate_MessagePushNotifications` | `FieldId` | `PageOfPageFeilds` | `Id` | 0 | 39,925 |
| `GENTranslate_News` | `BaseEntityFieldId` | `BaseEntityFields` | `Id` | 1 | 7,185 |
| `GENTranslate_News` | `LangId` | `GENListValues` | `Id` | 1 | 3,328 |
| `GENTranslate_News` | `NewsId` | `GENNews` | `Id` | 1 | 5 |
| `GENTranslate_News` | `FieldId` | `PageOfPageFeilds` | `Id` | 1 | 39,925 |
| `GENTranslate_NewsCategory` | `BaseEntityFieldId` | `BaseEntityFields` | `Id` | 0 | 7,185 |
| `GENTranslate_NewsCategory` | `LangId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENTranslate_NewsCategory` | `NewsCategoryId` | `GENNewsCategories` | `Id` | 0 | 2 |
| `GENTranslate_NewsCategory` | `FieldId` | `PageOfPageFeilds` | `Id` | 0 | 39,925 |
| `GENTranslate_PageOfPageFeilds` | `LangId` | `GENListValues` | `Id` | 1,927 | 3,328 |
| `GENTranslate_PageOfPageFeilds` | `PageOfPageFeildId` | `PageOfPageFeilds` | `Id` | 1,927 | 39,925 |
| `GENTranslate_PageOfPageRelation` | `LangId` | `GENListValues` | `Id` | 971 | 3,328 |
| `GENTranslate_PageOfPageRelation` | `PageOfPageId` | `GENPageOfPages` | `Id` | 971 | 348 |
| `GENTranslate_PageOfPageRelation` | `PageOfPageRelationId` | `PageOfPageRelations` | `Id` | 971 | 1,031 |
| `GENTranslate_PaymentMethod` | `BaseEntityFieldId` | `BaseEntityFields` | `Id` | 0 | 7,185 |
| `GENTranslate_PaymentMethod` | `LangId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENTranslate_PaymentMethod` | `PaymentMethodId` | `GENPaymentMethods` | `Id` | 0 | 7 |
| `GENTranslate_PaymentMethod` | `FieldId` | `PageOfPageFeilds` | `Id` | 0 | 39,925 |
| `GENTranslate_PhoneType` | `BaseEntityFieldId` | `BaseEntityFields` | `Id` | 0 | 7,185 |
| `GENTranslate_PhoneType` | `LangId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENTranslate_PhoneType` | `PhoneTypeId` | `GENPhoneTypes` | `Id` | 0 | 6 |
| `GENTranslate_PhoneType` | `FieldId` | `PageOfPageFeilds` | `Id` | 0 | 39,925 |
| `GENTranslate_Poll` | `BaseEntityFieldId` | `BaseEntityFields` | `Id` | 0 | 7,185 |
| `GENTranslate_Poll` | `LangId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENTranslate_Poll` | `PollId` | `GENPolls` | `Id` | 0 | 734 |
| `GENTranslate_Poll` | `FieldId` | `PageOfPageFeilds` | `Id` | 0 | 39,925 |
| `GENTranslate_PollAnswer` | `BaseEntityFieldId` | `BaseEntityFields` | `Id` | 0 | 7,185 |
| `GENTranslate_PollAnswer` | `LangId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENTranslate_PollAnswer` | `PollAnswerId` | `GENPollAnswers` | `Id` | 0 | 1,876 |
| `GENTranslate_PollAnswer` | `FieldId` | `PageOfPageFeilds` | `Id` | 0 | 39,925 |
| `GENTranslate_PollCategory` | `BaseEntityFieldId` | `BaseEntityFields` | `Id` | 0 | 7,185 |
| `GENTranslate_PollCategory` | `LangId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENTranslate_PollCategory` | `PollCategoryId` | `GENPollCategories` | `Id` | 0 | 65 |
| `GENTranslate_PollCategory` | `FieldId` | `PageOfPageFeilds` | `Id` | 0 | 39,925 |
| `GENTranslate_Project` | `BaseEntityFieldId` | `BaseEntityFields` | `Id` | 0 | 7,185 |
| `GENTranslate_Project` | `LangId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENTranslate_Project` | `ProjectId` | `GENProjects` | `Id` | 0 | 0 |
| `GENTranslate_Project` | `FieldId` | `PageOfPageFeilds` | `Id` | 0 | 39,925 |
| `GENTranslate_Province` | `BaseEntityFieldId` | `BaseEntityFields` | `Id` | 0 | 7,185 |
| `GENTranslate_Province` | `LangId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENTranslate_Province` | `ProvinceId` | `GENProvinces` | `Id` | 0 | 2 |
| `GENTranslate_Province` | `FieldId` | `PageOfPageFeilds` | `Id` | 0 | 39,925 |
| `GENTranslate_PushMSGs` | `BaseEntityFieldId` | `BaseEntityFields` | `Id` | 0 | 7,185 |
| `GENTranslate_PushMSGs` | `LangId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENTranslate_PushMSGs` | `FieldId` | `PageOfPageFeilds` | `Id` | 0 | 39,925 |
| `GENTranslate_PushMSGs` | `PushMSGId` | `PushMSGs` | `Id` | 0 | 176 |
| `GENTranslate_QuestionGroup` | `BaseEntityFieldId` | `BaseEntityFields` | `Id` | 0 | 7,185 |
| `GENTranslate_QuestionGroup` | `LangId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENTranslate_QuestionGroup` | `QuestionGroupId` | `GENQuestionGroups` | `Id` | 0 | 3 |
| `GENTranslate_QuestionGroup` | `FieldId` | `PageOfPageFeilds` | `Id` | 0 | 39,925 |
| `GENTranslate_QuoteType` | `BaseEntityFieldId` | `BaseEntityFields` | `Id` | 0 | 7,185 |
| `GENTranslate_QuoteType` | `QuoteTypeId` | `CRMQuoteTypes` | `Id` | 0 | 0 |
| `GENTranslate_QuoteType` | `LangId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENTranslate_QuoteType` | `FieldId` | `PageOfPageFeilds` | `Id` | 0 | 39,925 |
| `GENTranslate_RawData` | `BaseEntityFieldId` | `BaseEntityFields` | `Id` | 0 | 7,185 |
| `GENTranslate_RawData` | `LangId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENTranslate_RawData` | `RawDataId` | `GENRawDatas` | `Id` | 0 | 0 |
| `GENTranslate_RawData` | `FieldId` | `PageOfPageFeilds` | `Id` | 0 | 39,925 |
| `GENTranslate_RawDataCategory` | `BaseEntityFieldId` | `BaseEntityFields` | `Id` | 0 | 7,185 |
| `GENTranslate_RawDataCategory` | `LangId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENTranslate_RawDataCategory` | `FieldId` | `PageOfPageFeilds` | `Id` | 0 | 39,925 |
| `GENTranslate_RawDataCategory` | `RawDataCategoryId` | `RawDataCategories` | `Id` | 0 | 0 |
| `GENTranslate_RawDataType` | `BaseEntityFieldId` | `BaseEntityFields` | `Id` | 0 | 7,185 |
| `GENTranslate_RawDataType` | `LangId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENTranslate_RawDataType` | `RawDataTypeId` | `GENRawDataTypes` | `Id` | 0 | 2 |
| `GENTranslate_RawDataType` | `FieldId` | `PageOfPageFeilds` | `Id` | 0 | 39,925 |
| `GENTranslate_Reason` | `BaseEntityFieldId` | `BaseEntityFields` | `Id` | 0 | 7,185 |
| `GENTranslate_Reason` | `ReasonId` | `CRMSRVReasons` | `Id` | 0 | 0 |
| `GENTranslate_Reason` | `LangId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENTranslate_Reason` | `FieldId` | `PageOfPageFeilds` | `Id` | 0 | 39,925 |
| `GENTranslate_ReasonType` | `BaseEntityFieldId` | `BaseEntityFields` | `Id` | 0 | 7,185 |
| `GENTranslate_ReasonType` | `ReasonTypeId` | `CRMSRVReasonTypes` | `Id` | 0 | 0 |
| `GENTranslate_ReasonType` | `LangId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENTranslate_ReasonType` | `FieldId` | `PageOfPageFeilds` | `Id` | 0 | 39,925 |
| `GENTranslate_Region` | `BaseEntityFieldId` | `BaseEntityFields` | `Id` | 0 | 7,185 |
| `GENTranslate_Region` | `LangId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENTranslate_Region` | `RegionId` | `GENRegions1` | `Id` | 0 | 0 |
| `GENTranslate_Region` | `FieldId` | `PageOfPageFeilds` | `Id` | 0 | 39,925 |
| `GENTranslate_Regions` | `BaseEntityFieldId` | `BaseEntityFields` | `Id` | 0 | 7,185 |
| `GENTranslate_Regions` | `LangId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENTranslate_Regions` | `RegionsId` | `GENRegions` | `Id` | 0 | 8 |
| `GENTranslate_Regions` | `FieldId` | `PageOfPageFeilds` | `Id` | 0 | 39,925 |
| `GENTranslate_Request` | `BaseEntityFieldId` | `BaseEntityFields` | `Id` | 0 | 7,185 |
| `GENTranslate_Request` | `LangId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENTranslate_Request` | `RequestId` | `GENRequests` | `Id` | 0 | 0 |
| `GENTranslate_Request` | `FieldId` | `PageOfPageFeilds` | `Id` | 0 | 39,925 |
| `GENTranslate_RequestType` | `BaseEntityFieldId` | `BaseEntityFields` | `Id` | 0 | 7,185 |
| `GENTranslate_RequestType` | `LangId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENTranslate_RequestType` | `RequestTypeId` | `GENRequestTypes` | `Id` | 0 | 0 |
| `GENTranslate_RequestType` | `FieldId` | `PageOfPageFeilds` | `Id` | 0 | 39,925 |
| `GENTranslate_Role` | `RoleId` | `AspNetRoles` | `Id` | 3 | 14 |
| `GENTranslate_Role` | `BaseEntityFieldId` | `BaseEntityFields` | `Id` | 3 | 7,185 |
| `GENTranslate_Role` | `LangId` | `GENListValues` | `Id` | 3 | 3,328 |
| `GENTranslate_Role` | `FieldId` | `PageOfPageFeilds` | `Id` | 3 | 39,925 |
| `GENTranslate_Salutation` | `BaseEntityFieldId` | `BaseEntityFields` | `Id` | 0 | 7,185 |
| `GENTranslate_Salutation` | `LangId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENTranslate_Salutation` | `SalutationId` | `GENSalutations` | `Id` | 0 | 19 |
| `GENTranslate_Salutation` | `FieldId` | `PageOfPageFeilds` | `Id` | 0 | 39,925 |
| `GENTranslate_SawaSysMag` | `LangId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENTranslate_SawaSysMag` | `MessageId` | `GENSawaSysMsgs` | `Id` | 0 | 0 |
| `GENTranslate_SawaSysMag` | `FieldId` | `PageOfPageFeilds` | `Id` | 0 | 39,925 |
| `GENTranslate_SectionCategory` | `BaseEntityFieldId` | `BaseEntityFields` | `Id` | 0 | 7,185 |
| `GENTranslate_SectionCategory` | `LangId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENTranslate_SectionCategory` | `SectionCategoryId` | `GENSectionCategories` | `Id` | 0 | 0 |
| `GENTranslate_SectionCategory` | `FieldId` | `PageOfPageFeilds` | `Id` | 0 | 39,925 |
| `GENTranslate_Sections` | `BaseEntityFieldId` | `BaseEntityFields` | `Id` | 0 | 7,185 |
| `GENTranslate_Sections` | `LangId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENTranslate_Sections` | `SectionsId` | `GENSections` | `Id` | 0 | 2 |
| `GENTranslate_Sections` | `FieldId` | `PageOfPageFeilds` | `Id` | 0 | 39,925 |
| `GENTranslate_ServiceCategory` | `BaseEntityFieldId` | `BaseEntityFields` | `Id` | 0 | 7,185 |
| `GENTranslate_ServiceCategory` | `LangId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENTranslate_ServiceCategory` | `ServiceCategoryId` | `GENServiceCategories` | `Id` | 0 | 0 |
| `GENTranslate_ServiceCategory` | `FieldId` | `PageOfPageFeilds` | `Id` | 0 | 39,925 |
| `GENTranslate_Services` | `BaseEntityFieldId` | `BaseEntityFields` | `Id` | 0 | 7,185 |
| `GENTranslate_Services` | `LangId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENTranslate_Services` | `ServiceId` | `GENServices` | `Id` | 0 | 0 |
| `GENTranslate_Services` | `FieldId` | `PageOfPageFeilds` | `Id` | 0 | 39,925 |
| `GENTranslate_Source` | `BaseEntityFieldId` | `BaseEntityFields` | `Id` | 0 | 7,185 |
| `GENTranslate_Source` | `SourceId` | `CRMSources` | `Id` | 0 | 18 |
| `GENTranslate_Source` | `LangId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENTranslate_Source` | `FieldId` | `PageOfPageFeilds` | `Id` | 0 | 39,925 |
| `GENTranslate_SourceType` | `BaseEntityFieldId` | `BaseEntityFields` | `Id` | 0 | 7,185 |
| `GENTranslate_SourceType` | `SourceTypeId` | `CRMSourceTypes` | `Id` | 0 | 1 |
| `GENTranslate_SourceType` | `LangId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENTranslate_SourceType` | `FieldId` | `PageOfPageFeilds` | `Id` | 0 | 39,925 |
| `GENTranslate_SpecificationGroup` | `BaseEntityFieldId` | `BaseEntityFields` | `Id` | 0 | 7,185 |
| `GENTranslate_SpecificationGroup` | `LangId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENTranslate_SpecificationGroup` | `SpecificationGroupId` | `GENSpecificationGroups` | `Id` | 0 | 0 |
| `GENTranslate_SpecificationGroup` | `FieldId` | `PageOfPageFeilds` | `Id` | 0 | 39,925 |
| `GENTranslate_Status` | `BaseEntityFieldId` | `BaseEntityFields` | `Id` | 0 | 7,185 |
| `GENTranslate_Status` | `LangId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENTranslate_Status` | `StatusId` | `GENStatus` | `Id` | 0 | 9 |
| `GENTranslate_Status` | `FieldId` | `PageOfPageFeilds` | `Id` | 0 | 39,925 |
| `GENTranslate_StatusMessage` | `BaseEntityFieldId` | `BaseEntityFields` | `Id` | 0 | 7,185 |
| `GENTranslate_StatusMessage` | `LangId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENTranslate_StatusMessage` | `StatusMessageId` | `GENStatusMessages` | `Id` | 0 | 0 |
| `GENTranslate_StatusMessage` | `FieldId` | `PageOfPageFeilds` | `Id` | 0 | 39,925 |
| `GENTranslate_StatusMessageCategory` | `BaseEntityFieldId` | `BaseEntityFields` | `Id` | 0 | 7,185 |
| `GENTranslate_StatusMessageCategory` | `LangId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENTranslate_StatusMessageCategory` | `StatusMessageCategoryId` | `GENStatusMessageCategories` | `Id` | 0 | 0 |
| `GENTranslate_StatusMessageCategory` | `FieldId` | `PageOfPageFeilds` | `Id` | 0 | 39,925 |
| `GENTranslate_Stop` | `BaseEntityFieldId` | `BaseEntityFields` | `Id` | 0 | 7,185 |
| `GENTranslate_Stop` | `LangId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENTranslate_Stop` | `StopId` | `LOGStops` | `Id` | 0 | 0 |
| `GENTranslate_Stop` | `FieldId` | `PageOfPageFeilds` | `Id` | 0 | 39,925 |
| `GENTranslate_TabFeilds` | `TabFeildId` | `BasetabGENPageOfPages_Field` | `Id` | 0 | 1,004 |
| `GENTranslate_TabFeilds` | `LangId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENTranslate_Tag` | `BaseEntityFieldId` | `BaseEntityFields` | `Id` | 0 | 7,185 |
| `GENTranslate_Tag` | `LangId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENTranslate_Tag` | `TagId` | `GENTags` | `Id` | 0 | 1 |
| `GENTranslate_Tag` | `FieldId` | `PageOfPageFeilds` | `Id` | 0 | 39,925 |
| `GENTranslate_TicketType` | `BaseEntityFieldId` | `BaseEntityFields` | `Id` | 0 | 7,185 |
| `GENTranslate_TicketType` | `TicketTypeId` | `CRMSRVTicketTypes` | `Id` | 0 | 4 |
| `GENTranslate_TicketType` | `LangId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENTranslate_TicketType` | `FieldId` | `PageOfPageFeilds` | `Id` | 0 | 39,925 |
| `GENTranslate_Type` | `BaseEntityFieldId` | `BaseEntityFields` | `Id` | 313 | 7,185 |
| `GENTranslate_Type` | `LangId` | `GENListValues` | `Id` | 313 | 3,328 |
| `GENTranslate_Type` | `TypeId` | `GENTypes` | `Id` | 313 | 416 |
| `GENTranslate_Type` | `FieldId` | `PageOfPageFeilds` | `Id` | 313 | 39,925 |
| `GENTranslate_TypeCategory` | `BaseEntityFieldId` | `BaseEntityFields` | `Id` | 131 | 7,185 |
| `GENTranslate_TypeCategory` | `LangId` | `GENListValues` | `Id` | 131 | 3,328 |
| `GENTranslate_TypeCategory` | `TypeCategoryId` | `GENTypeCategories` | `Id` | 131 | 1,886 |
| `GENTranslate_TypeCategory` | `FieldId` | `PageOfPageFeilds` | `Id` | 131 | 39,925 |
| `GENTranslate_TypeStatus` | `BaseEntityFieldId` | `BaseEntityFields` | `Id` | 0 | 7,185 |
| `GENTranslate_TypeStatus` | `LangId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENTranslate_TypeStatus` | `TypeStatusId` | `GENTypeStatus` | `Id` | 0 | 15 |
| `GENTranslate_TypeStatus` | `FieldId` | `PageOfPageFeilds` | `Id` | 0 | 39,925 |
| `GENTranslate_Unit` | `BaseEntityFieldId` | `BaseEntityFields` | `Id` | 0 | 7,185 |
| `GENTranslate_Unit` | `LangId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENTranslate_Unit` | `UnitId` | `GENUnits` | `Id` | 0 | 1 |
| `GENTranslate_Unit` | `FieldId` | `PageOfPageFeilds` | `Id` | 0 | 39,925 |
| `GENTranslate_UnitCategory` | `BaseEntityFieldId` | `BaseEntityFields` | `Id` | 0 | 7,185 |
| `GENTranslate_UnitCategory` | `LangId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENTranslate_UnitCategory` | `UnitCategoryId` | `GENUnitCategories` | `Id` | 0 | 0 |
| `GENTranslate_UnitCategory` | `FieldId` | `PageOfPageFeilds` | `Id` | 0 | 39,925 |
| `GENTranslate_Vehicle` | `LangId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENTranslate_Vehicle` | `VehicleId` | `GENVehicles` | `Id` | 0 | 0 |
| `GENTranslate_Vehicle` | `FieldId` | `PageOfPageFeilds` | `Id` | 0 | 39,925 |
| `GENTranslate_VehicleType` | `BaseEntityFieldId` | `BaseEntityFields` | `Id` | 0 | 7,185 |
| `GENTranslate_VehicleType` | `LangId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENTranslate_VehicleType` | `VehicleTypeId` | `GENVehicleTypes` | `Id` | 0 | 0 |
| `GENTranslate_VehicleType` | `FieldId` | `PageOfPageFeilds` | `Id` | 0 | 39,925 |
| `GENTranslate_Vehicles` | `BaseEntityFieldId` | `BaseEntityFields` | `Id` | 0 | 7,185 |
| `GENTranslate_Vehicles` | `LangId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENTranslate_Vehicles` | `VehicleId` | `GENVehicles` | `Id` | 0 | 0 |
| `GENTranslate_Vehicles` | `FieldId` | `PageOfPageFeilds` | `Id` | 0 | 39,925 |
| `GENTranslate_Wiki` | `BaseEntityFieldId` | `BaseEntityFields` | `Id` | 1,636 | 7,185 |
| `GENTranslate_Wiki` | `LangId` | `GENListValues` | `Id` | 1,636 | 3,328 |
| `GENTranslate_Wiki` | `WikiId` | `GENWikis` | `Id` | 1,636 | 648 |
| `GENTranslate_Wiki` | `FieldId` | `PageOfPageFeilds` | `Id` | 1,636 | 39,925 |
| `GENTranslate_WikiCategory` | `BaseEntityFieldId` | `BaseEntityFields` | `Id` | 59 | 7,185 |
| `GENTranslate_WikiCategory` | `LangId` | `GENListValues` | `Id` | 59 | 3,328 |
| `GENTranslate_WikiCategory` | `WikiCategoryId` | `GENWikiCategories` | `Id` | 59 | 93 |
| `GENTranslate_WikiCategory` | `FieldId` | `PageOfPageFeilds` | `Id` | 59 | 39,925 |
| `GENTranslate_Zone` | `BaseEntityFieldId` | `BaseEntityFields` | `Id` | 0 | 7,185 |
| `GENTranslate_Zone` | `LangId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENTranslate_Zone` | `ZoneId` | `GENZones` | `Id` | 0 | 0 |
| `GENTranslate_Zone` | `FieldId` | `PageOfPageFeilds` | `Id` | 0 | 39,925 |
| `GENTypeCategories` | `DeletedById` | `AspNetUsers` | `Id` | 1,886 | 40,910 |
| `GENTypeCategories` | `IconId` | `GENStyles` | `Id` | 1,886 | 1,445 |
| `GENTypeCategories` | `TalentBuilderId` | `GENTalentBuilders` | `Id` | 1,886 | 40 |
| `GENTypeCategories` | `TalentId` | `GENTalents` | `Id` | 1,886 | 108 |
| `GENTypeCategories` | `ParentId` | `GENTypeCategories` | `Id` | 1,886 | 1,886 |
| `GENTypeStatus` | `ValueId1` | `GENListValues` | `Id` | 15 | 3,328 |
| `GENTypeStatus` | `ValueId2` | `GENListValues` | `Id` | 15 | 3,328 |
| `GENTypeStatus` | `ValueId3` | `GENListValues` | `Id` | 15 | 3,328 |
| `GENTypeStatus` | `ValueId4` | `GENListValues` | `Id` | 15 | 3,328 |
| `GENTypeStatus` | `ValueId5` | `GENListValues` | `Id` | 15 | 3,328 |
| `GENType_Course` | `DependencyCourseId` | `GENTypes` | `Id` | 2 | 416 |
| `GENType_Course` | `MainCourseId` | `GENTypes` | `Id` | 2 | 416 |
| `GENTypes` | `DeletedById` | `AspNetUsers` | `Id` | 416 | 40,910 |
| `GENTypes` | `LanguageId` | `GENListValues` | `Id` | 416 | 3,328 |
| `GENTypes` | `ValueId1` | `GENListValues` | `Id` | 416 | 3,328 |
| `GENTypes` | `ValueId2` | `GENListValues` | `Id` | 416 | 3,328 |
| `GENTypes` | `ValueId3` | `GENListValues` | `Id` | 416 | 3,328 |
| `GENTypes` | `ValueId4` | `GENListValues` | `Id` | 416 | 3,328 |
| `GENTypes` | `ValueId5` | `GENListValues` | `Id` | 416 | 3,328 |
| `GENTypes` | `IconId` | `GENStyles` | `Id` | 416 | 1,445 |
| `GENTypes` | `TypeCategoryId` | `GENTypeCategories` | `Id` | 416 | 1,886 |
| `GENUnitCategories` | `ValueId1` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENUnitCategories` | `ValueId2` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENUnitCategories` | `ValueId3` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENUnitCategories` | `ValueId4` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENUnitCategories` | `ValueId5` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENUnitCategories` | `IconId` | `GENStyles` | `Id` | 0 | 1,445 |
| `GENUnits` | `ValueId1` | `GENListValues` | `Id` | 1 | 3,328 |
| `GENUnits` | `ValueId2` | `GENListValues` | `Id` | 1 | 3,328 |
| `GENUnits` | `ValueId3` | `GENListValues` | `Id` | 1 | 3,328 |
| `GENUnits` | `ValueId4` | `GENListValues` | `Id` | 1 | 3,328 |
| `GENUnits` | `ValueId5` | `GENListValues` | `Id` | 1 | 3,328 |
| `GENUnits` | `IconId` | `GENStyles` | `Id` | 1 | 1,445 |
| `GENUnits` | `UnitCategoryId` | `GENUnitCategories` | `Id` | 1 | 0 |
| `GENUserDevices` | `GenderId` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENUserLikes` | `UserId` | `AspNetUsers` | `Id` | 0 | 40,910 |
| `GENUserLikes` | `ItemId` | `GENItems` | `Id` | 0 | 5,180 |
| `GENUserLocations` | `ContactId` | `GENContacts` | `Id` | 0 | 51,607 |
| `GENUserLocations` | `EmployeeId` | `GENEmployees` | `Id` | 0 | 824 |
| `GENUserLocations` | `RequestId` | `GENRequests` | `Id` | 0 | 0 |
| `GENVehicleTypeImages` | `VehicleTypeId` | `GENVehicleTypes` | `Id` | 0 | 0 |
| `GENVehicleTypes` | `ValueId1` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENVehicleTypes` | `ValueId2` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENVehicleTypes` | `ValueId3` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENVehicleTypes` | `ValueId4` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENVehicleTypes` | `ValueId5` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENVehicleTypes` | `IconId` | `GENStyles` | `Id` | 0 | 1,445 |
| `GENVehicleUsers` | `User_Id` | `AspNetUsers` | `Id` | 0 | 40,910 |
| `GENVehicleUsers` | `GENVehicle_Id` | `GENVehicles` | `Id` | 0 | 0 |
| `GENVehicles` | `BrandId` | `GENBrands` | `Id` | 0 | 10 |
| `GENVehicles` | `GENCompany_Id` | `GENCompanies` | `Id` | 0 | 6,045 |
| `GENVehicles` | `OwnerContactId` | `GENContacts` | `Id` | 0 | 51,607 |
| `GENVehicles` | `LicenseIssuerId` | `GENEmployees` | `Id` | 0 | 824 |
| `GENVehicles` | `OwnerEmployeeId` | `GENEmployees` | `Id` | 0 | 824 |
| `GENVehicles` | `ValueId1` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENVehicles` | `ValueId2` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENVehicles` | `ValueId3` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENVehicles` | `ValueId4` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENVehicles` | `ValueId5` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENVehicles` | `GENStatusId` | `GENStatus` | `Id` | 0 | 9 |
| `GENVehicles` | `IconId` | `GENStyles` | `Id` | 0 | 1,445 |
| `GENVehicles` | `VehicleTypeId` | `GENVehicleTypes` | `Id` | 0 | 0 |
| `GENVideos` | `BaseEntityId` | `BaseEntities` | `Id` | 7 | 203 |
| `GENVideos` | `LanguageId` | `GENListValues` | `Id` | 7 | 3,328 |
| `GENWikiAudios` | `WikiId` | `GENWikis` | `Id` | 0 | 648 |
| `GENWikiCategories` | `ValueId1` | `GENListValues` | `Id` | 93 | 3,328 |
| `GENWikiCategories` | `ValueId2` | `GENListValues` | `Id` | 93 | 3,328 |
| `GENWikiCategories` | `ValueId3` | `GENListValues` | `Id` | 93 | 3,328 |
| `GENWikiCategories` | `ValueId4` | `GENListValues` | `Id` | 93 | 3,328 |
| `GENWikiCategories` | `ValueId5` | `GENListValues` | `Id` | 93 | 3,328 |
| `GENWikiCategories` | `IconId` | `GENStyles` | `Id` | 93 | 1,445 |
| `GENWikiCategories` | `ParentId` | `GENWikiCategories` | `Id` | 93 | 93 |
| `GENWikiFiles` | `WikiId` | `GENWikis` | `Id` | 0 | 648 |
| `GENWikiVideos` | `WikiId` | `GENWikis` | `Id` | 3 | 648 |
| `GENWikis` | `DeletedById` | `AspNetUsers` | `Id` | 648 | 40,910 |
| `GENWikis` | `CertFrameId` | `GENCertificationFrames` | `Id` | 648 | 2 |
| `GENWikis` | `ContactId` | `GENContacts` | `Id` | 648 | 51,607 |
| `GENWikis` | `ValueId1` | `GENListValues` | `Id` | 648 | 3,328 |
| `GENWikis` | `ValueId2` | `GENListValues` | `Id` | 648 | 3,328 |
| `GENWikis` | `ValueId3` | `GENListValues` | `Id` | 648 | 3,328 |
| `GENWikis` | `ValueId4` | `GENListValues` | `Id` | 648 | 3,328 |
| `GENWikis` | `ValueId5` | `GENListValues` | `Id` | 648 | 3,328 |
| `GENWikis` | `IconId` | `GENStyles` | `Id` | 648 | 1,445 |
| `GENWikis` | `WikiCategoryId` | `GENWikiCategories` | `Id` | 648 | 93 |
| `GENZones` | `ValueId1` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENZones` | `ValueId2` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENZones` | `ValueId3` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENZones` | `ValueId4` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENZones` | `ValueId5` | `GENListValues` | `Id` | 0 | 3,328 |
| `GENZones` | `IconId` | `GENStyles` | `Id` | 0 | 1,445 |
| `HTMLTemplates` | `BaseEntityId` | `BaseEntities` | `Id` | 5 | 203 |
| `ImportLogDatas` | `UserId` | `AspNetUsers` | `Id` | 0 | 40,910 |
| `ImportLogDatas` | `BaseEntityId` | `BaseEntities` | `Id` | 0 | 203 |
| `ImportLogDatas` | `ReasonId` | `CRMSRVReasons` | `Id` | 0 | 0 |
| `ImportLogDatas` | `SourceId` | `CRMSources` | `Id` | 0 | 18 |
| `ImportLogDatas` | `CompanyId` | `GENCompanies` | `Id` | 0 | 6,045 |
| `ImportLogDatas` | `DepartmentId` | `GENDepartments` | `Id` | 0 | 6 |
| `ImportLogDatas` | `AssessmentId` | `GENListValues` | `Id` | 0 | 3,328 |
| `ImportLogDatas` | `GenderId` | `GENListValues` | `Id` | 0 | 3,328 |
| `ImportLogDatas` | `LanguageId` | `GENListValues` | `Id` | 0 | 3,328 |
| `ImportLogDatas` | `PriortyId` | `GENListValues` | `Id` | 0 | 3,328 |
| `ImportLogDatas` | `RentPeriodId` | `GENListValues` | `Id` | 0 | 3,328 |
| `ImportLogDatas` | `ValueId1` | `GENListValues` | `Id` | 0 | 3,328 |
| `ImportLogDatas` | `ValueId2` | `GENListValues` | `Id` | 0 | 3,328 |
| `ImportLogDatas` | `ValueId3` | `GENListValues` | `Id` | 0 | 3,328 |
| `ImportLogDatas` | `ValueId4` | `GENListValues` | `Id` | 0 | 3,328 |
| `ImportLogDatas` | `ValueId5` | `GENListValues` | `Id` | 0 | 3,328 |
| `ImportLogDatas` | `PaymentMethodId` | `GENPaymentMethods` | `Id` | 0 | 7 |
| `ImportLogDatas` | `RawDataTypeId` | `GENRawDataTypes` | `Id` | 0 | 2 |
| `ImportLogDatas` | `SalutationId` | `GENSalutations` | `Id` | 0 | 19 |
| `ImportLogDatas` | `StatusId` | `GENStatus` | `Id` | 0 | 9 |
| `ImportLogDatas` | `IconId` | `GENStyles` | `Id` | 0 | 1,445 |
| `ImportLogDatas` | `TypeId` | `GENTypes` | `Id` | 0 | 416 |
| `ImportLogDatas` | `ImportLogId` | `ImportLogs` | `Id` | 0 | 668 |
| `ImportLogDatas` | `RawDataCategoryId` | `RawDataCategories` | `Id` | 0 | 0 |
| `ImportLogs` | `PageofPageId` | `GENPageOfPages` | `Id` | 668 | 348 |
| `ItemFlatDatas` | `ValueId1` | `GENListValues` | `Id` | 0 | 3,328 |
| `ItemFlatDatas` | `ValueId2` | `GENListValues` | `Id` | 0 | 3,328 |
| `ItemFlatDatas` | `ValueId3` | `GENListValues` | `Id` | 0 | 3,328 |
| `ItemFlatDatas` | `ValueId4` | `GENListValues` | `Id` | 0 | 3,328 |
| `ItemFlatDatas` | `ValueId5` | `GENListValues` | `Id` | 0 | 3,328 |
| `ItemFlatDatas` | `IconId` | `GENStyles` | `Id` | 0 | 1,445 |
| `Items_Generic` | `TicketId` | `CRMTickets` | `Id` | 0 | 0 |
| `Items_Generic` | `ContactId` | `GENContacts` | `Id` | 0 | 51,607 |
| `Items_Generic` | `ItemId` | `GENItems` | `Id` | 0 | 5,180 |
| `Items_Generic` | `ItemListValueId` | `GENListValues` | `Id` | 0 | 3,328 |
| `Items_Generic` | `ListValueId` | `GENListValues` | `Id` | 0 | 3,328 |
| `Items_Generic` | `StatusId` | `GENStatus` | `Id` | 0 | 9 |
| `Items_Generic` | `ItemFlatDataId` | `ItemFlatDatas` | `Id` | 0 | 0 |
| `LOGRoutePoints` | `RouteId` | `LOGRoutes` | `Id` | 0 | 0 |
| `LOGRoute_LOGStop` | `RouteId` | `LOGRoutes` | `Id` | 0 | 0 |
| `LOGRoute_LOGStop` | `StopId` | `LOGStops` | `Id` | 0 | 0 |
| `LOGRoutes` | `IconId` | `GENStyles` | `Id` | 0 | 1,445 |
| `LOGStops` | `IconId` | `GENStyles` | `Id` | 0 | 1,445 |
| `ListValueTypeCategories` | `ValueId1` | `GENListValues` | `Id` | 0 | 3,328 |
| `ListValueTypeCategories` | `ValueId2` | `GENListValues` | `Id` | 0 | 3,328 |
| `ListValueTypeCategories` | `ValueId3` | `GENListValues` | `Id` | 0 | 3,328 |
| `ListValueTypeCategories` | `ValueId4` | `GENListValues` | `Id` | 0 | 3,328 |
| `ListValueTypeCategories` | `ValueId5` | `GENListValues` | `Id` | 0 | 3,328 |
| `ListValueTypeCategories` | `IconId` | `GENStyles` | `Id` | 0 | 1,445 |
| `LogMetadata` | `AuditLogId` | `AuditLogs` | `AuditLogId` | 0 | 968,393 |
| `OTP_Attendance` | `InstructorId` | `GENEmployees` | `Id` | 224 | 824 |
| `OTP_Attendance` | `TLMSClassroom_SessionId` | `TLMSClassroom_Session` | `Id` | 224 | 25,268 |
| `PageOfPageCustomFieldTabs` | `StyleId` | `GENStyles` | `Id` | 4 | 1,445 |
| `PageOfPageFeilds` | `FeildId` | `BaseEntityFields` | `Id` | 39,925 | 7,185 |
| `PageOfPageFeilds` | `PageOfPageId` | `GENPageOfPages` | `Id` | 39,925 | 348 |
| `PageOfPageRelations` | `FieldId` | `BaseEntityRelations` | `Id` | 1,031 | 573 |
| `PageOfPageRelations` | `PageOfPageId` | `GENPageOfPages` | `Id` | 1,031 | 348 |
| `PageofPageReport_Role` | `IdentityRoleId` | `AspNetRoles` | `Id` | 3 | 14 |
| `PageofPageReport_Role` | `PageOfPageId` | `GENPageOfPages` | `Id` | 3 | 348 |
| `PageofPageReport_Role` | `PageOfPageReportId` | `Reports` | `Id` | 3 | 53 |
| `PollCategoryandPolls` | `ValueId1` | `GENListValues` | `Id` | 1,202 | 3,328 |
| `PollCategoryandPolls` | `ValueId2` | `GENListValues` | `Id` | 1,202 | 3,328 |
| `PollCategoryandPolls` | `ValueId3` | `GENListValues` | `Id` | 1,202 | 3,328 |
| `PollCategoryandPolls` | `ValueId4` | `GENListValues` | `Id` | 1,202 | 3,328 |
| `PollCategoryandPolls` | `ValueId5` | `GENListValues` | `Id` | 1,202 | 3,328 |
| `PollCategoryandPolls` | `PollCategoryId` | `GENPollCategories` | `Id` | 1,202 | 65 |
| `PollCategoryandPolls` | `PollId` | `GENPolls` | `Id` | 1,202 | 734 |
| `PollCategoryandPolls` | `QuestionGroupId` | `GENQuestionGroups` | `Id` | 1,202 | 3 |
| `PollCategoryandPolls` | `IconId` | `GENStyles` | `Id` | 1,202 | 1,445 |
| `PushMSGUsers` | `UserId` | `AspNetUsers` | `Id` | 9,267 | 40,910 |
| `PushMSGUsers` | `ContactId` | `GENContacts` | `Id` | 9,267 | 51,607 |
| `PushMSGUsers` | `EmployeeId` | `GENEmployees` | `Id` | 9,267 | 824 |
| `PushMSGUsers` | `PushMSGId` | `PushMSGs` | `Id` | 9,267 | 176 |
| `RandomNumberVCRLogs` | `VCRId` | `GENClassrooms` | `Id` | 89 | 2,996 |
| `RawDataCategories` | `ValueId1` | `GENListValues` | `Id` | 0 | 3,328 |
| `RawDataCategories` | `ValueId2` | `GENListValues` | `Id` | 0 | 3,328 |
| `RawDataCategories` | `ValueId3` | `GENListValues` | `Id` | 0 | 3,328 |
| `RawDataCategories` | `ValueId4` | `GENListValues` | `Id` | 0 | 3,328 |
| `RawDataCategories` | `ValueId5` | `GENListValues` | `Id` | 0 | 3,328 |
| `RelatedPageofPages` | `PageofPageId` | `GENPageOfPages` | `Id` | 54,037 | 348 |
| `Reports` | `ValueId1` | `GENListValues` | `Id` | 53 | 3,328 |
| `Reports` | `ValueId2` | `GENListValues` | `Id` | 53 | 3,328 |
| `Reports` | `ValueId3` | `GENListValues` | `Id` | 53 | 3,328 |
| `Reports` | `ValueId4` | `GENListValues` | `Id` | 53 | 3,328 |
| `Reports` | `ValueId5` | `GENListValues` | `Id` | 53 | 3,328 |
| `Reports` | `IconId` | `GENStyles` | `Id` | 53 | 1,445 |
| `Repositories` | `BaseEntityId` | `BaseEntities` | `Id` | 0 | 203 |
| `RepositoryMethods` | `RepositoryId` | `Repositories` | `Id` | 0 | 0 |
| `SchedulerContacts` | `TicketCommentId` | `CRMSRVTicket_Comment` | `Id` | 0 | 0 |
| `SysErrorLogs` | `UserId` | `AspNetUsers` | `Id` | 923 | 40,910 |
| `SysErrorLogs` | `PageofPagesId` | `GENPageOfPages` | `Id` | 923 | 348 |
| `SysUserLoginHistories` | `LastUpdatedById` | `AspNetUsers` | `Id` | 8,300 | 40,910 |
| `SysUserLoginHistories` | `UserId` | `AspNetUsers` | `Id` | 8,300 | 40,910 |
| `TCRItems` | `DealItemId` | `CRMDealItems` | `Id` | 0 | 0 |
| `TCRItems` | `DealId` | `CRMDeals` | `Id` | 0 | 0 |
| `TCRItems` | `QuoteItemId` | `CRMQuoteItems` | `Id` | 0 | 0 |
| `TCRItems` | `ItemId` | `GENItems` | `Id` | 0 | 5,180 |
| `TCRItems` | `ProjectId` | `GENProjects` | `Id` | 0 | 0 |
| `TCRItems` | `TCRId` | `GENTCRs` | `Id` | 0 | 0 |
| `TCRItems` | `UnitId` | `GENUnits` | `Id` | 0 | 1 |
| `TCRWorkItems` | `DealItemId` | `CRMDealItems` | `Id` | 0 | 0 |
| `TCRWorkItems` | `DealId` | `CRMDeals` | `Id` | 0 | 0 |
| `TCRWorkItems` | `ItemId` | `GENItems` | `Id` | 0 | 5,180 |
| `TCRWorkItems` | `TCRId` | `GENTCRs` | `Id` | 0 | 0 |
| `TCRWorkItems` | `ItemFLatDataId` | `ItemFlatDatas` | `Id` | 0 | 0 |
| `TCRWorkItems` | `TCRItemId` | `TCRItems` | `Id` | 0 | 0 |
| `TCRWorkItems` | `WorkOrderId` | `TCRWorkOrders` | `Id` | 0 | 0 |
| `TCRWorkOrders` | `BranchId` | `GENBranches` | `Id` | 0 | 2 |
| `TCRWorkOrders` | `BrandId` | `GENBrands` | `Id` | 0 | 10 |
| `TCRWorkOrders` | `TCRId` | `GENTCRs` | `Id` | 0 | 0 |
| `TLMSClassroom_Session` | `ClassroomId` | `GENClassrooms` | `Id` | 25,268 | 2,996 |
| `TLMSClassroom_Session` | `InstructorId` | `GENEmployees` | `Id` | 25,268 | 824 |
| `TLMSClassroom_Session` | `SessionId` | `GENItems` | `Id` | 25,268 | 5,180 |
| `Translate_BaseTabs` | `PageOfPageBaseTabId` | `BaseTabGENPageOfPages` | `Id` | 170 | 1,207 |
| `Translate_BaseTabs` | `PageOfPageBaseTabId` | `BaseTabGENPageOfPages` | `Id` | 170 | 1,207 |
| `Translate_BaseTabs` | `LangId` | `GENListValues` | `Id` | 170 | 3,328 |
| `Translate_BaseTabs` | `PageOfPageId` | `GENPageOfPages` | `Id` | 170 | 348 |
| `Translate_PageOfPageCustomFieldTabs` | `LangId` | `GENListValues` | `Id` | 4 | 3,328 |
| `Translate_PageOfPageCustomFieldTabs` | `PageOfPageCustomFieldTabsId` | `PageOfPageCustomFieldTabs` | `Id` | 4 | 4 |
| `Translate_Specification` | `BaseEntityFieldId` | `BaseEntityFields` | `Id` | 0 | 7,185 |
| `Translate_Specification` | `LangId` | `GENListValues` | `Id` | 0 | 3,328 |
| `Translate_Specification` | `SpecificationId` | `GENSpecifications` | `Id` | 0 | 0 |
| `Translate_Specification` | `FieldId` | `PageOfPageFeilds` | `Id` | 0 | 39,925 |
| `TransmissionHistroys` | `WikiId` | `GENWikis` | `Id` | 28,137 | 648 |
| `Zoom_Session` | `VcrId` | `GENClassrooms` | `Id` | 18 | 2,996 |
| `Zoom_Session` | `SessionId` | `GENItems` | `Id` | 18 | 5,180 |
| `Zoom_Session` | `TalentId` | `GENTalents` | `Id` | 18 | 108 |
| `Zoom_Session` | `CourseId` | `GENTypes` | `Id` | 18 | 416 |
