import { useEffect, useState } from "react"
import { useAuth } from "./providers/AuthProvider"
import { client } from "../lib/client"
import type { ProjectMetadata } from "../gen/proto/v1/api_pb"
import { Table } from "./shared/Table"
import { ProjectView } from "./ProjectView"

export function Projects() {
    const [projectList, setProjectList] = useState<ProjectMetadata[]>([])
    const [selectedProjectId, setSelectedProjectId] = useState("");
    const userId = useAuth()

    useEffect(() => {
        const fetchProjects = async () => {
            const projects = await client.listProjects({ userId })
            setProjectList(projects.projects)
        }
        fetchProjects()
    }, [userId])

    return ( selectedProjectId === "" ?
        <Table<ProjectMetadata>
            data={projectList}
            columns={[
                { key: "name", header: "Project Title"},
                { key: "description", header: "Project Descriptions" },
                { key: "createdAt", header: "Created At" }
            ]}
            onSelectRow={ (row) => setSelectedProjectId(row.id)}
            /> : <ProjectView projectId={selectedProjectId} />
    )
}