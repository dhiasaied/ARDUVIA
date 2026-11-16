import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { LearnerProfile, LessonDetail, LessonSummary, Locale, ProgressSnapshot, Settings } from './models';

/** Thin typed client for the Symfony REST API. */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api';

  lessons(locale: Locale): Observable<LessonSummary[]> {
    return this.http.get<LessonSummary[]>(`${this.base}/lessons`, { params: { locale } });
  }

  lesson(slug: string, locale: Locale): Observable<LessonDetail> {
    return this.http.get<LessonDetail>(`${this.base}/lessons/${slug}`, { params: { locale } });
  }

  createLearner(): Observable<LearnerProfile> {
    return this.http.post<LearnerProfile>(`${this.base}/learners`, {});
  }

  learner(token: string): Observable<LearnerProfile> {
    return this.http.get<LearnerProfile>(`${this.base}/learners/${token}`);
  }

  updateSettings(token: string, patch: Partial<Settings> & { locale?: Locale }): Observable<LearnerProfile> {
    return this.http.patch<LearnerProfile>(`${this.base}/learners/${token}/settings`, patch);
  }

  recordProgress(token: string, slug: string, completed = true): Observable<ProgressSnapshot> {
    return this.http.put<ProgressSnapshot>(`${this.base}/learners/${token}/progress/${slug}`, { completed });
  }

  resetProgress(token: string): Observable<ProgressSnapshot> {
    return this.http.delete<ProgressSnapshot>(`${this.base}/learners/${token}/progress`);
  }
}
