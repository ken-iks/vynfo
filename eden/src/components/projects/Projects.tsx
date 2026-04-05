import { useEffect, useState } from "react"
import { useAuth } from "../providers/AuthProvider"
import { client } from "../../lib/client"
import type { ProjectMetadata } from "../../gen/proto/v1/api_pb"
import { timestampDate } from "@bufbuild/protobuf/wkt"
import { Table } from "../shared/Table"
import { ProjectView } from "./ProjectView"
import { ProjectConfigDropDown } from "./ProjectConfigDropdown"
import { MediaHolder } from "../video/MediaHolder"
import { Button } from "../ui/button"
import { ArrowLeftIcon } from "@heroicons/react/24/outline"


export type ProjectPage = "list" | "view" | "uploadVideo" | "uploadImage";

export function Projects() {
    const [projectPage, setProjectPage] = useState<ProjectPage>("list")
    const [projectList, setProjectList] = useState<ProjectMetadata[]>([])
    const [selectedProject, setSelectedProject] = useState<ProjectMetadata>();
    const userId = useAuth()

    useEffect(() => {
        const fetchProjects = async () => {
            const projects = await client.listProjects({ userId })
            setProjectList(projects.projects)
        }
        fetchProjects()
    }, [userId])

    switch (projectPage) {
        case "list":
            return (
                <Table<ProjectMetadata>
                title="Projects"
                data={projectList}
                columns={[
                    { key: "name", header: "Project Title"},
                    { key: "description", header: "Project Descriptions" },
                    { key: "createdAt", header: "Created At", render: (_value, row) => {
                        if (!row.createdAt) return "—"
                        const date = timestampDate(row.createdAt)
                        return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
                    }}
                ]}
                onSelectRow={ (row) => { setSelectedProject(row); setProjectPage("view") }}
                />
            )
        case "view":
            return (
                <div className="relative h-full">
                    <div className="absolute top-2 left-2 z-10">
                        <Button variant="outline" onClick={() => setProjectPage("list")}>
                            <ArrowLeftIcon className="size-4" />
                            Back to Projects
                        </Button>
                    </div>
                    <div className="absolute top-2 right-8 z-10">
                        <ProjectConfigDropDown handlePageSelection={setProjectPage} />
                    </div>
                    { selectedProject && <ProjectView project={selectedProject} /> }
                </div>
                
            )
        case "uploadVideo":
            return (
                <div className="relative h-full">
                    <div className="absolute top-2 left-2 z-10">
                        <Button variant="outline" onClick={() => setProjectPage("view")}>
                            <ArrowLeftIcon className="size-4" />
                            Back to Project
                        </Button>
                    </div>
                    <MediaHolder />
                </div>
            )
        default:
            return null
    }
}