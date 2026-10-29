"""Platform sections ("modules") that can be switched off in the ``.env`` file.

A module that is off disappears for everyone, super admins included: its
sidebar items are hidden, its pages are blocked in the web app and its API
routes answer 404. Turning it back on brings everything back unchanged; no
data is deleted.

    OMNILEARN_FEATURE_POSTGRADUATE=false
    OMNILEARN_FEATURE_TRAINING_PROGRAMS=false
    OMNILEARN_FEATURE_FINANCE=false
    OMNILEARN_FEATURE_ANALYTICS=false
    OMNILEARN_FEATURE_REPORTS=false
    OMNILEARN_FEATURE_NEWS=false
    OMNILEARN_FEATURE_ONLINE_CLASSES=false

Keep the module names and their sidebar items in sync with
``apps/web/lib/modules.ts`` and ``apps/web/lib/dash-nav-items.ts``.
"""

from typing import Callable, NamedTuple

from fastapi import HTTPException, status

from config.config import ModulesConfig, load_modules_config


class ModuleDef(NamedTuple):
    label: str
    # Dashboard sidebar items (ids from src/security/rbac/nav_items.py) that
    # belong to this module and disappear with it.
    nav_items: tuple[str, ...]
    # Calendar event id prefixes (see services/calendar/events.py) it owns.
    calendar_events: tuple[str, ...] = ()


MODULES: dict[str, ModuleDef] = {
    "postgraduate": ModuleDef(
        "Postgraduate Studies",
        ("postgraduate", "postgraduate-teaching"),
        calendar_events=("session:", "term:", "interview:", "test:"),
    ),
    "training_programs": ModuleDef(
        "Training Programs", ("training-programs",), calendar_events=("program:",)
    ),
    "finance": ModuleDef("Finance", ("finance",)),
    "analytics": ModuleDef("Analytics", ("analytics",)),
    "reports": ModuleDef("Reports", ("reports",)),
    "news": ModuleDef("News", ("cms-news",)),
    "online_classes": ModuleDef("Online classes", ("online-classes",)),
}

assert set(MODULES) == set(ModulesConfig.model_fields), "MODULES and ModulesConfig must list the same modules"


def module_states() -> dict[str, bool]:
    """Every module and whether it is on, e.g. ``{"postgraduate": True, ...}``."""
    return load_modules_config().model_dump()


def is_module_enabled(module: str) -> bool:
    if module not in MODULES:
        raise KeyError(f"Unknown module: {module}")
    return bool(getattr(load_modules_config(), module))


def disabled_modules() -> list[str]:
    return [name for name, on in module_states().items() if not on]


def disabled_nav_items() -> list[str]:
    """Sidebar item ids hidden because their module is off."""
    return [item for name in disabled_modules() for item in MODULES[name].nav_items]


def disabled_calendar_prefixes() -> tuple[str, ...]:
    return tuple(p for name in disabled_modules() for p in MODULES[name].calendar_events)


def require_module(module: str) -> Callable[[], None]:
    """FastAPI dependency: 404 when ``module`` is switched off.

    Use on a whole router (``include_router(..., dependencies=[Depends(require_module("finance"))])``)
    or on a single route.
    """
    if module not in MODULES:
        raise KeyError(f"Unknown module: {module}")

    def _check() -> None:
        if not is_module_enabled(module):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "code": "module_disabled",
                    "module": module,
                    "message": f"{MODULES[module].label} is turned off on this platform.",
                },
            )

    _check.__name__ = f"require_module_{module}"
    return _check
