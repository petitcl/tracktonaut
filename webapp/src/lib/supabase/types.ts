/**
 * CUSTOM TYPE ALIASES - SAFE TO EDIT
 *
 * This file contains helper type aliases that won't be overwritten
 * by type generation. Add your custom types here.
 */

import type { Tables, TablesInsert, TablesUpdate } from './database.types'

// Table row types
export type Profile = Tables<'profiles'>
export type Metric = Tables<'metrics'>
export type DailyCheckin = Tables<'daily_checkin'>
export type MetricEntry = Tables<'metric_entry'>
export type PushSubscription = Tables<'push_subscriptions'>
export type ReminderSettings = Tables<'reminder_settings'>

// Insert types (for creating new records)
export type ProfileInsert = TablesInsert<'profiles'>
export type MetricInsert = TablesInsert<'metrics'>
export type DailyCheckinInsert = TablesInsert<'daily_checkin'>
export type MetricEntryInsert = TablesInsert<'metric_entry'>
export type PushSubscriptionInsert = TablesInsert<'push_subscriptions'>
export type ReminderSettingsInsert = TablesInsert<'reminder_settings'>

// Update types (for updating existing records)
export type ProfileUpdate = TablesUpdate<'profiles'>
export type MetricUpdate = TablesUpdate<'metrics'>
export type DailyCheckinUpdate = TablesUpdate<'daily_checkin'>
export type MetricEntryUpdate = TablesUpdate<'metric_entry'>
export type PushSubscriptionUpdate = TablesUpdate<'push_subscriptions'>
export type ReminderSettingsUpdate = TablesUpdate<'reminder_settings'>

// Metric types (from enum)
export type MetricType = 'boolean' | 'rating' | 'number' | 'select' | 'tags' | 'notes'
export type MetricDirection = 'positive' | 'negative'
export type CheckinStatus = 'draft' | 'submitted'

// Metric config types (for type-safe config objects)
export interface RatingConfig {
  scaleMin: number
  scaleMax: number
}

export interface NumberConfig {
  unit?: string
  min?: number
  max?: number
  higherIsBetter?: boolean
}

export interface SelectOption {
  key: string
  label: string
  order: number
}

export interface SelectConfig {
  options: SelectOption[]
}

export interface TagOption {
  key: string
  label: string
}

export interface TagsConfig {
  options: TagOption[]
}

// Metric entry value types
export interface MetricEntryValue {
  bool_value?: boolean
  int_value?: number
  float_value?: number
  text_value?: string
  select_key?: string
  tag_keys?: string[]
}

// Time range types
export type TimeRange = '7d' | '1M' | '6M' | '1Y'

// Supported languages
export type SupportedLanguage = 'en' | 'es' | 'fr' | 'de'
