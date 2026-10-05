'use client';
import { updateProfile } from '@services/settings/profile'
import { getUser } from '@services/users/users'
import React, { useEffect, useState, useCallback } from 'react'
import { Formik, Form } from 'formik'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import {
  AlertTriangle,
  AtSign,
  Briefcase,
  GraduationCap,
  MapPin,
  Building2,
  Globe,
  Laptop2,
  Award,
  BookOpen,
  Link,
  Users,
  Calendar,
  Lightbulb,
  Camera,
  Check,
  FileWarning,
  Loader2,
  Mail,
  Plus,
  Sparkles,
  Trash2,
  UserRound,
} from 'lucide-react'
import UserAvatar from '@components/Objects/UserAvatar'
import { updateUserAvatar } from '@services/users/users'
import { constructAcceptValue } from '@/lib/constants'
import * as Yup from 'yup'
import { Field, inputCls } from '@components/Dashboard/Pages/Academic/AcademicForm'
import { cn } from '@/lib/utils'
import { SettingsCard } from '@components/Objects/Account/AccountUI'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@components/ui/dropdown-menu"
import { toast } from 'react-hot-toast'
import { signOut } from '@components/Contexts/AuthContext'
import { getUriWithoutOrg } from '@services/config/config';
import { useDebounce } from '@/hooks/useDebounce';
import { useTranslation } from 'react-i18next';
import { useOmniLearnAnalytics, AnalyticsEvent } from '@services/analytics';

const SUPPORTED_FILES = constructAcceptValue(['jpg', 'png', 'webp', 'gif'])

const AVAILABLE_ICONS = [
  { name: 'briefcase', labelKey: 'user.settings.general.icons.briefcase', component: Briefcase },
  { name: 'graduation-cap', labelKey: 'user.settings.general.icons.education', component: GraduationCap },
  { name: 'map-pin', labelKey: 'user.settings.general.icons.location', component: MapPin },
  { name: 'building-2', labelKey: 'user.settings.general.icons.organization', component: Building2 },
  { name: 'speciality', labelKey: 'user.settings.general.icons.speciality', component: Lightbulb },
  { name: 'globe', labelKey: 'user.settings.general.icons.website', component: Globe },
  { name: 'laptop-2', labelKey: 'user.settings.general.icons.tech', component: Laptop2 },
  { name: 'award', labelKey: 'user.settings.general.icons.achievement', component: Award },
  { name: 'book-open', labelKey: 'user.settings.general.icons.book', component: BookOpen },
  { name: 'link', labelKey: 'user.settings.general.icons.link', component: Link },
  { name: 'users', labelKey: 'user.settings.general.icons.community', component: Users },
  { name: 'calendar', labelKey: 'user.settings.general.icons.calendar', component: Calendar },
] as const;

const IconComponent = ({ iconName }: { iconName: string }) => {
  const iconConfig = AVAILABLE_ICONS.find(i => i.name === iconName);
  if (!iconConfig) return null;
  const IconElement = iconConfig.component;
  return <IconElement className="w-4 h-4" />;
};

interface DetailItem {
  id: string;
  label: string;
  icon: string;
  text: string;
}

interface FormValues {
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  bio: string;
  details: {
    [key: string]: DetailItem;
  };
}

const DETAIL_TEMPLATES = {
  general: [
    { id: 'title', label: 'Title', icon: 'briefcase', text: '' },
    { id: 'affiliation', label: 'Affiliation', icon: 'building-2', text: '' },
    { id: 'location', label: 'Location', icon: 'map-pin', text: '' },
    { id: 'website', label: 'Website', icon: 'globe', text: '' },
    { id: 'linkedin', label: 'LinkedIn', icon: 'link', text: '' }
  ],
  academic: [
    { id: 'institution', label: 'Institution', icon: 'building-2', text: '' },
    { id: 'department', label: 'Department', icon: 'graduation-cap', text: '' },
    { id: 'research', label: 'Research Area', icon: 'book-open', text: '' },
    { id: 'academic-title', label: 'Academic Title', icon: 'award', text: '' }
  ],
  professional: [
    { id: 'company', label: 'Company', icon: 'building-2', text: '' },
    { id: 'industry', label: 'Industry', icon: 'briefcase', text: '' },
    { id: 'expertise', label: 'Expertise', icon: 'laptop-2', text: '' },
    { id: 'community', label: 'Community', icon: 'users', text: '' }
  ]
} as const;

const validationSchema = Yup.object().shape({
  email: Yup.string().email('Invalid email').required('Email is required'),
  username: Yup.string().required('Username is required'),
  first_name: Yup.string().required('First name is required'),
  last_name: Yup.string().required('Last name is required'),
  bio: Yup.string().max(400, 'Bio must be 400 characters or less'),
  details: Yup.object().shape({})
});

// Memoized detail card component for better performance
const DetailCard = React.memo(({
  id,
  detail,
  onUpdate,
  onRemove,
  onLabelChange
}: {
  id: string;
  detail: DetailItem;
  onUpdate: (_id: string, _field: keyof DetailItem, _value: string) => void;
  onRemove: (_id: string) => void;
  onLabelChange: (_id: string, _newLabel: string) => void;
}) => {
  const { t } = useTranslation();
  const [localLabel, setLocalLabel] = useState(detail.label);

  const debouncedLabelChange = useDebounce((newLabel: string) => {
    if (newLabel !== detail.label) {
      onLabelChange(id, newLabel);
    }
  }, 500);

  const handleLabelChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newLabel = e.target.value;
    setLocalLabel(newLabel);
    debouncedLabelChange(newLabel);
  }, [debouncedLabelChange]);

  const handleIconChange = useCallback((value: string) => {
    onUpdate(id, 'icon', value);
  }, [id, onUpdate]);

  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdate(id, 'text', e.target.value);
  }, [id, onUpdate]);

  const handleRemove = useCallback(() => {
    onRemove(id);
  }, [id, onRemove]);

  useEffect(() => {
    setLocalLabel(detail.label);
  }, [detail.label]);

  return (
    <div className="group/detail grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-2xl border border-[hsl(var(--dash-border))] bg-white p-2 transition-shadow hover:shadow-[0_6px_16px_-10px_hsl(220_30%_20%/0.35)] sm:grid-cols-[auto_minmax(0,0.8fr)_minmax(0,1.2fr)_auto]">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={t('user.settings.general.icon')}
            title={t('user.settings.general.select_icon')}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[hsl(var(--dash-border))] bg-[hsl(var(--dash-canvas))] text-[hsl(var(--dash-ink))] transition-colors hover:border-[hsl(var(--dash-accent))]/40 hover:bg-[hsl(var(--dash-accent-soft))]"
          >
            {detail.icon ? <IconComponent iconName={detail.icon} /> : <Sparkles className="h-4 w-4 text-[hsl(var(--dash-muted))]" />}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64 rounded-xl p-1.5">
          <DropdownMenuLabel className="px-1.5 pb-1.5 text-xs font-medium text-[hsl(var(--dash-muted))]">{t('user.settings.general.select_icon')}</DropdownMenuLabel>
          <div className="grid grid-cols-4 gap-1">
            {AVAILABLE_ICONS.map((icon) => (
              <DropdownMenuItem
                key={icon.name}
                onSelect={() => handleIconChange(icon.name)}
                title={t(icon.labelKey)}
                className={cn(
                  'flex h-12 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg p-1 text-[10px]',
                  detail.icon === icon.name && 'bg-[hsl(var(--dash-accent-soft))] text-[hsl(var(--dash-accent))]'
                )}
              >
                <icon.component className="h-4 w-4" />
                <span className="w-full truncate text-center">{t(icon.labelKey)}</span>
              </DropdownMenuItem>
            ))}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
      <input
        value={localLabel}
        onChange={handleLabelChange}
        placeholder={t('user.settings.general.detail_label_placeholder')}
        aria-label={t('user.settings.general.detail_label_placeholder')}
        className={cn(inputCls, 'h-10 rounded-xl font-medium')}
      />
      <input
        value={detail.text}
        onChange={handleTextChange}
        placeholder={t('user.settings.general.text_placeholder')}
        aria-label={t('user.settings.general.text')}
        className={cn(inputCls, 'col-span-2 h-10 rounded-xl sm:col-span-1')}
      />
      <button
        type="button"
        onClick={handleRemove}
        aria-label={t('user.settings.general.remove')}
        title={t('user.settings.general.remove')}
        className="row-start-1 flex h-10 w-10 items-center justify-center rounded-xl text-[hsl(var(--dash-muted))] transition-colors hover:bg-[hsl(var(--dash-warn-soft))] hover:text-[hsl(var(--dash-warn))] sm:row-start-auto"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
});

DetailCard.displayName = 'DetailCard';

const TEMPLATE_ICONS = { general: Briefcase, academic: GraduationCap, professional: Building2 } as const

// Form component to handle the details section
const UserEditForm = ({
  values,
  setFieldValue,
  handleChange,
  errors,
  touched,
  isSubmitting,
  dirty,
  resetForm,
  initialEmail,
  profilePicture
}: {
  values: FormValues;
  setFieldValue: (_field: string, _value: any) => void;
  handleChange: (_e: React.ChangeEvent<any>) => void;
  errors: any;
  touched: any;
  isSubmitting: boolean;
  dirty: boolean;
  resetForm: () => void;
  initialEmail: string;
  profilePicture: {
    error: string | undefined;
    success: string;
    isLoading: boolean;
    localAvatar: File | null;
    handleFileChange: (_event: any) => Promise<void>;
  };
}) => {
  const { t } = useTranslation();
  const bioLength = values.bio?.length || 0
  const emailChanged = !!initialEmail && values.email !== initialEmail
  const fullName = [values.first_name, values.last_name].filter(Boolean).join(' ')
  const detailEntries = Object.entries(values.details)
  const errorOf = (field: keyof FormValues) => (touched[field] && errors[field] ? String(errors[field]) : undefined)

  return (
    <Form className="space-y-5">
      {/* Identity + photo */}
      <section className="overflow-hidden rounded-[1.25rem] border border-[hsl(var(--dash-border))]/70 bg-white shadow-[0_1px_2px_hsl(220_30%_20%/0.04)]">
        <div className="relative h-28 bg-[linear-gradient(135deg,hsl(0_0%_12%),hsl(0_0%_5%))] sm:h-32">
          <div
            aria-hidden="true"
            className="absolute inset-0 opacity-[0.06]"
            style={{ backgroundImage: 'radial-gradient(hsl(43 80% 70%) 1px, transparent 1px)', backgroundSize: '18px 18px' }}
          />
          <div aria-hidden="true" className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[hsl(43_80%_60%/0.5)] to-transparent" />
        </div>
        <div className="flex flex-col gap-4 px-5 pb-5 sm:flex-row sm:items-end sm:px-6">
          <div className="relative -mt-12 w-fit shrink-0">
            <div className="rounded-full bg-white p-1 shadow-[0_10px_30px_-12px_hsl(220_30%_20%/0.5)]">
              {profilePicture.localAvatar ? (
                <UserAvatar border="border-0" rounded="rounded-full" width={104} avatar_url={URL.createObjectURL(profilePicture.localAvatar)} />
              ) : (
                <UserAvatar border="border-0" rounded="rounded-full" width={104} />
              )}
            </div>
            {profilePicture.isLoading ? (
              <span className="absolute inset-1 flex items-center justify-center rounded-full bg-black/45 text-white">
                <Loader2 className="h-6 w-6 animate-spin" />
              </span>
            ) : null}
            <input type="file" id="fileInput" accept={SUPPORTED_FILES} className="hidden" onChange={profilePicture.handleFileChange} />
            <button
              type="button"
              onClick={() => document.getElementById('fileInput')?.click()}
              disabled={profilePicture.isLoading}
              aria-label={t('user.settings.general.change_avatar')}
              title={t('user.settings.general.change_avatar')}
              className="absolute bottom-1 end-1 flex h-9 w-9 items-center justify-center rounded-full bg-[hsl(43_80%_56%)] text-[hsl(0_0%_8%)] shadow-[0_6px_16px_-6px_hsl(43_80%_45%/0.9)] ring-4 ring-white transition-transform hover:scale-105 disabled:opacity-60"
            >
              <Camera className="h-4 w-4" />
            </button>
          </div>
          <div className="min-w-0 flex-1 sm:pb-1">
            <h1 className="truncate text-xl font-semibold tracking-tight text-[hsl(var(--dash-ink))]">{fullName || values.username}</h1>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[hsl(var(--dash-muted))]">
              <span>@{values.username}</span>
              {initialEmail ? (
                <span className="inline-flex items-center gap-1">
                  <Mail className="h-3.5 w-3.5" /> {initialEmail}
                </span>
              ) : null}
            </p>
          </div>
          <div className="flex flex-col items-start gap-1.5 sm:items-end sm:pb-1">
            <button
              type="button"
              onClick={() => document.getElementById('fileInput')?.click()}
              disabled={profilePicture.isLoading}
              className="inline-flex items-center gap-2 rounded-full border border-[hsl(var(--dash-border))] bg-white px-4 py-2 text-sm font-semibold text-[hsl(var(--dash-ink))] transition-colors hover:bg-[hsl(var(--dash-canvas))] disabled:opacity-60"
            >
              <Camera className="h-4 w-4" />
              {profilePicture.isLoading ? t('user.settings.general.uploading') : t('user.settings.general.change_avatar')}
            </button>
            {profilePicture.error ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[hsl(var(--dash-warn))]">
                <FileWarning className="h-3.5 w-3.5" /> {profilePicture.error}
              </span>
            ) : profilePicture.success ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                <Check className="h-3.5 w-3.5" /> {profilePicture.success}
              </span>
            ) : (
              <span className="text-xs text-[hsl(var(--dash-muted))]">{t('user.settings.general.recommended_size')}</span>
            )}
          </div>
        </div>
      </section>

      {/* Personal information */}
      <SettingsCard
        icon={<UserRound className="h-[18px] w-[18px]" />}
        title={t('user.settings.general.personal_title', 'Personal information')}
        description={t('user.settings.general.personal_desc', 'Your name as it appears on courses, certificates and discussions.')}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t('user.settings.general.first_name')} required error={errorOf('first_name')}>
            <input
              name="first_name"
              value={values.first_name}
              onChange={handleChange}
              placeholder={t('user.settings.general.first_name_placeholder')}
              aria-invalid={!!errorOf('first_name')}
              className={cn(inputCls, 'h-10 rounded-xl')}
            />
          </Field>
          <Field label={t('user.settings.general.last_name')} required error={errorOf('last_name')}>
            <input
              name="last_name"
              value={values.last_name}
              onChange={handleChange}
              placeholder={t('user.settings.general.last_name_placeholder')}
              aria-invalid={!!errorOf('last_name')}
              className={cn(inputCls, 'h-10 rounded-xl')}
            />
          </Field>
          <Field
            label={t('user.settings.general.username')}
            required
            error={errorOf('username')}
            hint={t('user.settings.general.username_hint', 'Used in your profile link and mentions.')}
          >
            <div className="relative">
              <AtSign className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--dash-muted))]" />
              <input
                name="username"
                value={values.username}
                onChange={handleChange}
                placeholder={t('user.settings.general.username_placeholder')}
                aria-invalid={!!errorOf('username')}
                className={cn(inputCls, 'h-10 rounded-xl ps-9')}
              />
            </div>
          </Field>
          <Field label={t('user.settings.general.email')} required error={errorOf('email')}>
            <div className="relative">
              <Mail className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--dash-muted))]" />
              <input
                name="email"
                type="email"
                value={values.email}
                onChange={handleChange}
                placeholder={t('user.settings.general.email_placeholder')}
                aria-invalid={!!errorOf('email')}
                className={cn(inputCls, 'h-10 rounded-xl ps-9')}
              />
            </div>
          </Field>
          {emailChanged ? (
            <div className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-800 sm:col-span-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{t('user.settings.general.logout_warning')}</span>
            </div>
          ) : null}
        </div>
      </SettingsCard>

      {/* About */}
      <SettingsCard
        icon={<BookOpen className="h-[18px] w-[18px]" />}
        title={t('user.settings.general.bio')}
        description={t('user.settings.general.bio_desc', 'A short introduction shown on your public profile.')}
        action={
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums',
              bioLength > 360 ? 'bg-amber-50 text-amber-700' : 'bg-[hsl(var(--dash-canvas))] text-[hsl(var(--dash-muted))]'
            )}
          >
            {bioLength} / 400
          </span>
        }
      >
        <Field label="" error={errorOf('bio')}>
          <textarea
            name="bio"
            value={values.bio}
            onChange={handleChange}
            placeholder={t('user.settings.general.bio_placeholder')}
            aria-label={t('user.settings.general.bio')}
            maxLength={400}
            rows={5}
            className={cn(inputCls, 'min-h-[132px] rounded-xl leading-relaxed')}
          />
        </Field>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-[hsl(var(--dash-canvas))]">
          <div
            className={cn('h-full rounded-full transition-[width] duration-300', bioLength > 360 ? 'bg-amber-500' : 'bg-[hsl(var(--dash-accent))]')}
            style={{ width: `${(bioLength / 400) * 100}%` }}
          />
        </div>
      </SettingsCard>

      {/* Additional details */}
      <SettingsCard
        icon={<Sparkles className="h-[18px] w-[18px]" />}
        title={t('user.settings.general.additional_details')}
        description={t('user.settings.general.details_desc', 'Title, affiliation, links… shown as highlights on your profile.')}
        action={
          detailEntries.length > 0 ? (
            <button
              type="button"
              onClick={() => setFieldValue('details', {})}
              className="rounded-full px-3 py-1.5 text-xs font-semibold text-[hsl(var(--dash-muted))] transition-colors hover:bg-[hsl(var(--dash-warn-soft))] hover:text-[hsl(var(--dash-warn))]"
            >
              {t('user.settings.general.clear_all')}
            </button>
          ) : null
        }
      >
        <div className="mb-4 flex flex-wrap gap-2">
          {Object.entries(DETAIL_TEMPLATES).map(([key, template]) => {
            const TemplateIcon = TEMPLATE_ICONS[key as keyof typeof TEMPLATE_ICONS]
            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  const currentIds = new Set(Object.keys(values.details));
                  const newDetails = { ...values.details };
                  template.forEach((item) => {
                    if (!currentIds.has(item.id)) {
                      newDetails[item.id] = {
                        ...item,
                        label: t(`user.settings.general.labels.${item.id.replace('-', '_')}`, { defaultValue: item.label })
                      };
                    }
                  });
                  setFieldValue('details', newDetails);
                }}
                className="inline-flex items-center gap-2 rounded-full border border-[hsl(var(--dash-border))] bg-white px-3.5 py-1.5 text-xs font-semibold text-[hsl(var(--dash-ink))] transition-all hover:-translate-y-0.5 hover:border-[hsl(var(--dash-accent))]/40 hover:bg-[hsl(var(--dash-accent-soft))]"
              >
                <TemplateIcon className="h-3.5 w-3.5 text-[hsl(var(--dash-accent))]" />
                {t(`user.settings.general.add_${key}`)}
              </button>
            )
          })}
          <button
            type="button"
            onClick={() => {
              const newDetails = { ...values.details };
              const id = `detail-${Date.now()}`;
              newDetails[id] = { id, label: t('user.settings.general.new_detail', 'New detail'), icon: '', text: '' };
              setFieldValue('details', newDetails);
            }}
            className="inline-flex items-center gap-1.5 rounded-full bg-[hsl(var(--dash-ink))] px-3.5 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90"
          >
            <Plus className="h-3.5 w-3.5" />
            {t('user.settings.general.add_detail')}
          </button>
        </div>

        {detailEntries.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-[hsl(var(--dash-border))] px-4 py-8 text-center">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[hsl(var(--dash-canvas))] text-[hsl(var(--dash-muted))]">
              <Sparkles className="h-5 w-5" />
            </span>
            <p className="mt-2.5 text-sm font-semibold text-[hsl(var(--dash-ink))]">{t('user.settings.general.no_details', 'No details yet')}</p>
            <p className="mt-0.5 max-w-xs text-xs text-[hsl(var(--dash-muted))]">
              {t('user.settings.general.no_details_hint', 'Add a ready-made set above, or your own detail.')}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {detailEntries.map(([id, detail]) => (
              <DetailCard
                key={id}
                id={id}
                detail={detail}
                onUpdate={(id, field, value) => {
                  const newDetails = { ...values.details };
                  newDetails[id] = { ...newDetails[id], [field]: value };
                  setFieldValue('details', newDetails);
                }}
                onRemove={(id) => {
                  const newDetails = { ...values.details };
                  delete newDetails[id];
                  setFieldValue('details', newDetails);
                }}
                onLabelChange={(id, newLabel) => {
                  const newDetails = { ...values.details };
                  newDetails[id] = { ...newDetails[id], label: newLabel };
                  setFieldValue('details', newDetails);
                }}
              />
            ))}
          </div>
        )}
      </SettingsCard>

      {/* Save bar: sticks to the bottom while there are unsaved edits. */}
      <div
        className={cn(
          'z-20 flex items-center justify-between gap-3 rounded-full py-2 pe-2 ps-5 text-sm transition-all duration-300',
          dirty
            ? 'sticky bottom-4 bg-[hsl(var(--dash-ink))] text-white shadow-[0_18px_40px_-18px_hsl(0_0%_0%/0.6)]'
            : 'border border-[hsl(var(--dash-border))]/70 bg-white text-[hsl(var(--dash-muted))]'
        )}
      >
        <span>{dirty ? t('administration.common.unsaved', 'You have unsaved changes') : t('user.settings.general.all_saved', 'All changes saved')}</span>
        <div className="flex items-center gap-2">
          {dirty ? (
            <button type="button" onClick={() => resetForm()} className="rounded-full px-3 py-1.5 text-xs font-medium text-white/80 hover:bg-white/10 hover:text-white">
              {t('administration.common.discard', 'Discard')}
            </button>
          ) : null}
          <button
            type="submit"
            disabled={isSubmitting || !dirty}
            className="rounded-full bg-[hsl(43_80%_56%)] px-5 py-2 text-xs font-semibold text-[hsl(0_0%_8%)] transition-all hover:brightness-110 disabled:opacity-50"
          >
            {isSubmitting ? t('user.settings.general.saving') : t('user.settings.general.save_changes')}
          </button>
        </div>
      </div>
    </Form>
  );
};

function AccountGeneral() {
  const session = useLHSession() as any;
  const access_token = session?.data?.tokens?.access_token;
  const [localAvatar, setLocalAvatar] = React.useState(null) as any
  const [isLoading, setIsLoading] = React.useState(false) as any
  const [error, setError] = React.useState() as any
  const [success, setSuccess] = React.useState('') as any
  const [userData, setUserData] = useState<any>(null);
  const { t } = useTranslation();
  const { track } = useOmniLearnAnalytics('learner');

  useEffect(() => {
    const fetchUserData = async () => {
      if (session?.data?.user?.id) {
        try {
          const data = await getUser(session.data.user.id, access_token);
          setUserData(data);
        } catch (error) {
          console.error('Error fetching user data:', error);
          setError('Failed to load user data');
        }
      }
    };

    fetchUserData();
  }, [session?.data?.user?.id, access_token]);

  const handleFileChange = async (event: any) => {
    const file = event.target.files[0]
    setLocalAvatar(file)
    setIsLoading(true)
    const res = await updateUserAvatar(session.data.user.id, file, access_token)
    if (res.success === false) {
      setError(res.HTTPmessage)
    } else {
      // Force refresh session to pick up the new avatar filename
      await session.update(true)
      setIsLoading(false)
      setError('')
      setSuccess(t('user.settings.general.avatar_updated'))
    }
  }

  const handleEmailChange = async (newEmail: string) => {
    toast.success(t('user.settings.general.profile_updated'), { duration: 4000 })

    toast((_t_toast: any) => (
      <div className="flex items-center gap-2">
        <span>{t('user.settings.general.relogin_message', { email: newEmail })}</span>
      </div>
    ), {
      duration: 4000,
      icon: '📧'
    })

    await new Promise(resolve => setTimeout(resolve, 4000))
    signOut({ redirect: true, callbackUrl: getUriWithoutOrg('/') })
  }

  if (!userData) {
    return (
      <div className="space-y-5">
        <div className="h-48 animate-pulse rounded-[1.25rem] bg-white" />
        <div className="h-64 animate-pulse rounded-[1.25rem] bg-white" />
      </div>
    );
  }

  // The user endpoint returns a public view without the email; use the session's.
  const initialEmail: string = userData.email || session?.data?.user?.email || ''

  return (
    <div>
      <Formik<FormValues>
        enableReinitialize
        initialValues={{
          username: userData.username,
          first_name: userData.first_name,
          last_name: userData.last_name,
          email: initialEmail,
          bio: userData.bio || '',
          details: userData.details || {},
        }}
        validationSchema={validationSchema}
        onSubmit={(values, { setSubmitting }) => {
          const isEmailChanged = values.email !== initialEmail
          const loadingToast = toast.loading(t('user.settings.general.saving'))

          setTimeout(() => {
            setSubmitting(false)
            updateProfile(values, userData.id, access_token)
              .then(() => {
                toast.dismiss(loadingToast)
                track(AnalyticsEvent.AccountProfileUpdated, {
                  email_changed: isEmailChanged,
                  has_bio: !!values.bio?.trim(),
                })
                if (isEmailChanged) {
                  handleEmailChange(values.email)
                } else {
                  toast.success(t('user.settings.general.profile_updated'))
                }
                getUser(userData.id, access_token).then(setUserData);
              })
              .catch(() => {
                toast.error(t('user.settings.general.update_failed', 'Could not update your profile'), { id: loadingToast })
              })
          }, 400)
        }}
      >
        {(formikProps) => (
          <UserEditForm
            {...formikProps}
            resetForm={() => formikProps.resetForm()}
            initialEmail={initialEmail}
            profilePicture={{
              error,
              success,
              isLoading,
              localAvatar,
              handleFileChange
            }}
          />
        )}
      </Formik>
    </div>
  );
}

export default AccountGeneral
