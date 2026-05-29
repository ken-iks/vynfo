from dataclasses import dataclass
from typing import Any
from pydantic import BaseModel
from pydantic_ai import Agent, RunContext
from tavily import TavilyClient



@dataclass
class VynfoAgentDeps:
    search_client: TavilyClient

vynfo_agent = Agent[VynfoAgentDeps, str](
    "openai:gpt-5.5",
    instructions="You are a test agent that is being used to test a connection to the service",
    deps_type=VynfoAgentDeps,
)

class WebSearchArgs(BaseModel):
    query: str

@vynfo_agent.tool
def web_search(ctx: RunContext[VynfoAgentDeps], args: WebSearchArgs)-> dict[str, Any]:
    response = ctx.deps.search_client.search(
        query=args.query,
        include_answer=True
    )
    return response

class FetchPageArgs(BaseModel):
    urls: list[str]

@vynfo_agent.tool
def fetch_page(ctx: RunContext[VynfoAgentDeps], args: FetchPageArgs):
    response = ctx.deps.search_client.extract(urls=args.urls)
    return response