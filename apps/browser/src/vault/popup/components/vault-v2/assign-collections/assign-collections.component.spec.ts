import { Location } from "@angular/common";
import { NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ActivatedRoute } from "@angular/router";
import { mock } from "jest-mock-extended";
import { Subject } from "rxjs";

import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";

import { AssignCollections } from "./assign-collections.component";

describe("AssignCollections", () => {
  let component: AssignCollections;
  let fixture: ComponentFixture<AssignCollections>;

  const queryParams$ = new Subject();

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AssignCollections],
      providers: [
        {
          provide: I18nService,
          useValue: { t: (key: string) => key },
        },
        {
          provide: Location,
          useValue: mock<Location>(),
        },
        {
          provide: ActivatedRoute,
          useValue: { queryParams: queryParams$ },
        },
        {
          provide: PlatformUtilsService,
          useValue: mock<PlatformUtilsService>(),
        },
        {
          provide: ConfigService,
          useValue: mock<ConfigService>(),
        },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AssignCollections);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("creates", () => {
    expect(component).toBeTruthy();
  });
});
