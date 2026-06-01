from dataclasses import dataclass
from functools import cache
from typing import Any
from pydantic import BaseModel
from pydantic_ai import Agent, RunContext
from tavily import TavilyClient


@dataclass
class VynfoAgentDeps:
    search_client: TavilyClient


class WebSearchArgs(BaseModel):
    query: str


def web_search(ctx: RunContext[VynfoAgentDeps], args: WebSearchArgs) -> dict[str, Any]:
    response = ctx.deps.search_client.search(query=args.query, include_answer=True)
    return response


class FetchPageArgs(BaseModel):
    urls: list[str]


def fetch_page(ctx: RunContext[VynfoAgentDeps], args: FetchPageArgs):
    response = ctx.deps.search_client.extract(urls=args.urls)
    return response


@cache
def get_vynfo_agent() -> Agent[VynfoAgentDeps, str]:
    agent = Agent[VynfoAgentDeps, str](
        "openai-responses:gpt-5.5",
        instructions="You are a test agent that is being used to test a connection to the service",
        deps_type=VynfoAgentDeps,
    )
    agent.tool(web_search)
    agent.tool(fetch_page)
    return agent
