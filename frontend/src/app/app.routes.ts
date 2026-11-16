import { Component } from '@angular/core';
import { Routes } from '@angular/router';
import { preferredLocale } from './core/i18n';

/**
 * The shell (App) renders everything and reads the URL itself:
 * /:lang/:lesson → e.g. /en/blink, /fr/blink, /es/blink, /ar/blink.
 * The bare URL goes to the learner's saved language (English by default). These empty routes just make the URLs valid.
 */
@Component({ template: '' })
class RouteMarker {}

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: () => `${preferredLocale()}/board` },
  { path: ':lang', pathMatch: 'full', redirectTo: ':lang/board' },
  { path: ':lang/:slug', component: RouteMarker },
  { path: '**', redirectTo: () => `${preferredLocale()}/board` },
];
