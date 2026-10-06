"""The notification event catalog: what can be sent, with which variables.

Each event documents its ``{{variables}}`` (with sample values for previews)
and a built-in message per language, used when the org has not written its own
template. Events with ``builtin_email`` already had a hard-coded platform email;
for those the original email is still sent when no template exists.
"""
from dataclasses import dataclass, field
from typing import Dict, List, Optional


@dataclass(frozen=True)
class Variable:
    name: str
    description: str
    sample: str


@dataclass(frozen=True)
class BuiltinMessage:
    subject: str
    body: str  # HTML for email
    sms: str


@dataclass(frozen=True)
class EventDef:
    key: str
    label: str
    label_ar: str
    description: str
    variables: List[Variable]
    builtin: Dict[str, BuiltinMessage]
    required: bool = False
    builtin_email: bool = False
    default_channels: Dict[str, bool] = field(default_factory=lambda: {"email": True, "sms": False})


COMMON_VARIABLES = [
    Variable("user_first_name", "Recipient first name", "Mona"),
    Variable("user_last_name", "Recipient last name", "Ali"),
    Variable("user_full_name", "Recipient full name", "Mona Ali"),
    Variable("user_email", "Recipient email", "mona@example.com"),
    Variable("org_name", "Academy name", "Egyptian Academy"),
    Variable("platform_url", "Academy website", "https://academy.example.com"),
]
COURSE_VARIABLES = [
    Variable("course_name", "Course or program name", "Cybersecurity Fundamentals"),
    Variable("course_url", "Link to the course", "https://academy.example.com/course/cyber"),
]


STAFF_VARIABLES = [
    Variable("role_label", "Their role", "Course instructor"),
    Variable("item_name", "What they were assigned to", "Cybersecurity Fundamentals"),
    Variable("item_url", "Link to it", "https://academy.example.com/dash/courses/course/cyber"),
]


def _msg(subject: str, heading: str, text: str, cta: Optional[str] = None, link_var: str = "course_url", sms: str = "") -> BuiltinMessage:
    button = (
        f'<p><a href="{{{{{link_var}}}}}" style="display:inline-block;padding:12px 28px;background:#000;color:#fff;'
        f'border-radius:10px;text-decoration:none;font-weight:700">{cta}</a></p>'
        if cta
        else ""
    )
    return BuiltinMessage(subject=subject, body=f"<h1>{heading}</h1><p>{text}</p>{button}", sms=sms)


EVENTS: List[EventDef] = [
    EventDef(
        key="account_created",
        label="Account created",
        label_ar="إنشاء حساب",
        description="Welcome message when an account is created.",
        variables=[*COMMON_VARIABLES, Variable("login_url", "Sign-in link", "https://academy.example.com/login")],
        builtin_email=True,
        builtin={
            "en": _msg("Welcome to {{org_name}}", "Welcome, {{user_first_name}}!", "Your account at {{org_name}} is ready.", "Sign in", "login_url", "Welcome to {{org_name}}, {{user_first_name}}. Sign in: {{login_url}}"),
            "ar": _msg("مرحباً بك في {{org_name}}", "مرحباً {{user_first_name}}!", "حسابك في {{org_name}} جاهز.", "تسجيل الدخول", "login_url", "مرحباً بك في {{org_name}} يا {{user_first_name}}. للدخول: {{login_url}}"),
        },
    ),
    EventDef(
        key="password_setup",
        label="Set your password",
        label_ar="تعيين كلمة المرور",
        description="Sent to accounts created by the academy or an import, to choose a password.",
        variables=[*COMMON_VARIABLES, Variable("setup_link", "Password setup link", "https://academy.example.com/reset?code=123456"), Variable("setup_code", "One-time code", "123456")],
        required=True,
        builtin={
            "en": _msg("Set your password for {{org_name}}", "Welcome, {{user_first_name}}", "An account was created for you at {{org_name}}. Use code <strong>{{setup_code}}</strong> or the button below to choose your password.", "Set password", "setup_link", "{{org_name}}: your account is ready. Code {{setup_code}} — set your password: {{setup_link}}"),
            "ar": _msg("عيّن كلمة المرور لحسابك في {{org_name}}", "مرحباً {{user_first_name}}", "تم إنشاء حساب لك في {{org_name}}. استخدم الرمز <strong>{{setup_code}}</strong> أو الزر أدناه لاختيار كلمة المرور.", "تعيين كلمة المرور", "setup_link", "{{org_name}}: حسابك جاهز. الرمز {{setup_code}} — عيّن كلمة المرور: {{setup_link}}"),
        },
    ),
    EventDef(
        key="password_reset",
        label="Password reset",
        label_ar="إعادة تعيين كلمة المرور",
        description="Reset code requested from the sign-in page.",
        variables=[*COMMON_VARIABLES, Variable("reset_code", "One-time reset code", "482913"), Variable("reset_link", "Reset link", "https://academy.example.com/reset?resetCode=482913")],
        required=True,
        builtin_email=True,
        builtin={
            "en": _msg("Reset your password", "Reset your password", "Hi {{user_first_name}}, use code <strong>{{reset_code}}</strong> or the button below.", "Reset password", "reset_link", "{{org_name}} password reset code: {{reset_code}}"),
            "ar": _msg("إعادة تعيين كلمة المرور", "إعادة تعيين كلمة المرور", "مرحباً {{user_first_name}}، استخدم الرمز <strong>{{reset_code}}</strong> أو الزر أدناه.", "إعادة التعيين", "reset_link", "رمز إعادة تعيين كلمة المرور في {{org_name}}: {{reset_code}}"),
        },
    ),
    EventDef(
        key="invitation",
        label="Invitation",
        label_ar="دعوة",
        description="Invitation to join the academy.",
        variables=[*COMMON_VARIABLES, Variable("invite_link", "Sign-up link", "https://academy.example.com/signup?inviteCode=abc"), Variable("inviter_name", "Who invited them", "Academy Admin"), Variable("invite_code", "Invite code", "abc123")],
        builtin_email=True,
        builtin={
            "en": _msg("You are invited to {{org_name}}", "You are invited", "{{inviter_name}} invited you to join {{org_name}}.", "Accept invitation", "invite_link", "{{inviter_name}} invited you to {{org_name}}: {{invite_link}}"),
            "ar": _msg("دعوة للانضمام إلى {{org_name}}", "لقد تمت دعوتك", "دعاك {{inviter_name}} للانضمام إلى {{org_name}}.", "قبول الدعوة", "invite_link", "دعاك {{inviter_name}} للانضمام إلى {{org_name}}: {{invite_link}}"),
        },
    ),
    EventDef(
        key="role_changed",
        label="Role changed",
        label_ar="تغيير الدور",
        description="A member's role in the academy changed.",
        variables=[*COMMON_VARIABLES, Variable("role_name", "New role", "Instructor")],
        builtin_email=True,
        builtin={
            "en": _msg("Your role at {{org_name}} changed", "Your role changed", "You are now <strong>{{role_name}}</strong> at {{org_name}}.", sms="Your role at {{org_name}} is now {{role_name}}."),
            "ar": _msg("تغيّر دورك في {{org_name}}", "تغيّر دورك", "أصبح دورك <strong>{{role_name}}</strong> في {{org_name}}.", sms="أصبح دورك في {{org_name}}: {{role_name}}."),
        },
    ),
    EventDef(
        key="course_enrolled",
        label="Enrolled in a course",
        label_ar="التسجيل في دورة",
        description="A learner enrolled (or was enrolled) in a course.",
        variables=[*COMMON_VARIABLES, *COURSE_VARIABLES],
        default_channels={"email": False, "sms": False},
        builtin={
            "en": _msg("You are enrolled in {{course_name}}", "You're in!", "You are now enrolled in <strong>{{course_name}}</strong>.", "Open course", sms="You are enrolled in {{course_name}}: {{course_url}}"),
            "ar": _msg("تم تسجيلك في {{course_name}}", "تم تسجيلك!", "أنت الآن مسجل في <strong>{{course_name}}</strong>.", "فتح الدورة", sms="تم تسجيلك في {{course_name}}: {{course_url}}"),
        },
    ),
    EventDef(
        key="course_assigned",
        label="Training assigned",
        label_ar="إسناد تدريب",
        description="A course or program was assigned to the learner (directly, by group, position or entity).",
        variables=[*COMMON_VARIABLES, *COURSE_VARIABLES, Variable("due_date", "Due date (if any)", "2026-11-30")],
        builtin={
            "en": _msg("New training: {{course_name}}", "New training assigned", "<strong>{{course_name}}</strong> was assigned to you.", "Start now", sms="New training assigned: {{course_name}} {{course_url}}"),
            "ar": _msg("تدريب جديد: {{course_name}}", "تم إسناد تدريب جديد", "تم إسناد <strong>{{course_name}}</strong> إليك.", "ابدأ الآن", sms="تم إسناد تدريب جديد: {{course_name}} {{course_url}}"),
        },
    ),
    EventDef(
        key="course_completed",
        label="Course completed",
        label_ar="إتمام دورة",
        description="The learner completed every activity of a course.",
        variables=[*COMMON_VARIABLES, *COURSE_VARIABLES, Variable("completion_date", "Completion date", "2026-10-15")],
        builtin={
            "en": _msg("Congratulations on completing {{course_name}}", "Well done, {{user_first_name}}!", "You completed <strong>{{course_name}}</strong>.", "View course", sms="Congratulations! You completed {{course_name}}."),
            "ar": _msg("تهانينا على إتمام {{course_name}}", "أحسنت يا {{user_first_name}}!", "لقد أتممت <strong>{{course_name}}</strong>.", "عرض الدورة", sms="تهانينا! أتممت {{course_name}}."),
        },
    ),
    EventDef(
        key="certificate_issued",
        label="Certificate issued",
        label_ar="إصدار شهادة",
        description="A certificate was issued to the learner.",
        variables=[*COMMON_VARIABLES, *COURSE_VARIABLES, Variable("certificate_id", "Certificate number", "CERT-2026-0042"), Variable("certificate_url", "Certificate link", "https://academy.example.com/certificates/abc/verify")],
        builtin={
            "en": _msg("Your certificate for {{course_name}}", "Your certificate is ready", "Certificate <strong>{{certificate_id}}</strong> for {{course_name}} was issued.", "View certificate", "certificate_url", sms="Your certificate for {{course_name}} is ready: {{certificate_url}}"),
            "ar": _msg("شهادتك في {{course_name}}", "شهادتك جاهزة", "تم إصدار الشهادة <strong>{{certificate_id}}</strong> في {{course_name}}.", "عرض الشهادة", "certificate_url", sms="شهادتك في {{course_name}} جاهزة: {{certificate_url}}"),
        },
    ),
    EventDef(
        key="training_reminder",
        label="Session reminder",
        label_ar="تذكير بموعد جلسة",
        description="Sent before a scheduled session starts.",
        variables=[*COMMON_VARIABLES, *COURSE_VARIABLES, Variable("session_title", "Session title", "Session 3: Network security"), Variable("session_date", "Date", "2026-10-20"), Variable("session_time", "Start time", "10:00"), Variable("location", "Room / location", "Training Room A")],
        builtin={
            "en": _msg("Reminder: {{session_title}} on {{session_date}}", "Session reminder", "<strong>{{session_title}}</strong> ({{course_name}}) starts on {{session_date}} at {{session_time}} — {{location}}.", "Open course", sms="Reminder: {{session_title}} ({{course_name}}) {{session_date}} {{session_time}}, {{location}}"),
            "ar": _msg("تذكير: {{session_title}} يوم {{session_date}}", "تذكير بموعد الجلسة", "تبدأ <strong>{{session_title}}</strong> ({{course_name}}) يوم {{session_date}} الساعة {{session_time}} — {{location}}.", "فتح الدورة", sms="تذكير: {{session_title}} ({{course_name}}) {{session_date}} {{session_time}}، {{location}}"),
        },
    ),
    EventDef(
        key="exam_reminder",
        label="Assignment / exam due",
        label_ar="تذكير بموعد اختبار",
        description="Sent before an assignment or exam is due.",
        variables=[*COMMON_VARIABLES, *COURSE_VARIABLES, Variable("exam_name", "Assignment / exam", "Final exam"), Variable("due_date", "Due date", "2026-10-25")],
        builtin={
            "en": _msg("Due soon: {{exam_name}}", "Due soon", "<strong>{{exam_name}}</strong> in {{course_name}} is due on {{due_date}}.", "Open course", sms="Due {{due_date}}: {{exam_name}} ({{course_name}})"),
            "ar": _msg("موعد قريب: {{exam_name}}", "الموعد يقترب", "موعد تسليم <strong>{{exam_name}}</strong> في {{course_name}} هو {{due_date}}.", "فتح الدورة", sms="الموعد {{due_date}}: {{exam_name}} ({{course_name}})"),
        },
    ),
    EventDef(
        key="teaching_assigned",
        label="Teaching assigned",
        label_ar="إسناد تدريس",
        description="Someone was made the instructor, lecturer, teaching assistant or session instructor of a course or offering.",
        variables=[*COMMON_VARIABLES, *STAFF_VARIABLES],
        builtin={
            "en": _msg("You're teaching {{item_name}}", "New teaching assignment", "You are now <strong>{{role_label}}</strong> of <strong>{{item_name}}</strong>.", "Open", "item_url", "{{org_name}}: you are now {{role_label}} of {{item_name}}. {{item_url}}"),
            "ar": _msg("إسناد تدريس: {{item_name}}", "إسناد تدريس جديد", "أصبحت <strong>{{role_label}}</strong> في <strong>{{item_name}}</strong>.", "فتح", "item_url", "{{org_name}}: أصبحت {{role_label}} في {{item_name}}. {{item_url}}"),
        },
    ),
    EventDef(
        key="coordination_assigned",
        label="Coordinator appointed",
        label_ar="تعيين منسق",
        description="Someone was made coordinator of a training program, postgraduate program, cohort or entity.",
        variables=[*COMMON_VARIABLES, *STAFF_VARIABLES],
        builtin={
            "en": _msg("You're coordinating {{item_name}}", "You're the coordinator", "You are now <strong>{{role_label}}</strong> of <strong>{{item_name}}</strong>.", "Open", "item_url", "{{org_name}}: you are now {{role_label}} of {{item_name}}. {{item_url}}"),
            "ar": _msg("تعيينك منسقًا: {{item_name}}", "تم تعيينك منسقًا", "أصبحت <strong>{{role_label}}</strong> لـ <strong>{{item_name}}</strong>.", "فتح", "item_url", "{{org_name}}: أصبحت {{role_label}} لـ {{item_name}}. {{item_url}}"),
        },
    ),
    EventDef(
        key="contributor_added",
        label="Added as contributor",
        label_ar="إضافة كمساهم",
        description="Someone was given access to edit a course's content.",
        variables=[*COMMON_VARIABLES, *STAFF_VARIABLES],
        default_channels={"email": False, "sms": False},
        builtin={
            "en": _msg("You can now edit {{item_name}}", "You're a contributor", "You can now edit the content of <strong>{{item_name}}</strong>.", "Open course", "item_url", "{{org_name}}: you can now edit {{item_name}}. {{item_url}}"),
            "ar": _msg("يمكنك الآن تعديل {{item_name}}", "أصبحت مساهمًا", "يمكنك الآن تعديل محتوى <strong>{{item_name}}</strong>.", "فتح الدورة", "item_url", "{{org_name}}: يمكنك الآن تعديل {{item_name}}. {{item_url}}"),
        },
    ),
]

EVENTS_BY_KEY: Dict[str, EventDef] = {e.key: e for e in EVENTS}


def get_event(key: str) -> Optional[EventDef]:
    return EVENTS_BY_KEY.get(key)


def sample_variables(event: EventDef) -> Dict[str, str]:
    return {v.name: v.sample for v in event.variables}
