package editor

// ingest video
// get frame for each second
// store video + frames
// db will get video id - frames will be quad numbered - aka 0001 - 9999
// single row per vid - path will be /vedit-v2/projectId/videoId/branchName/video.jpeg for video, and /vedit-v2/videoId/branchName/frame{0001}.png for first frame

// Projects table:
// primary key projectId, mainCommitIds, leafCommitIds[], assetIds[], contributorIds[],

// Assets are sources that are used in videos. Can be source videos, audio, text, images
// video / audio will be stored in cloud
// text can just stay in the db
// images will be stored in cloud, but
// so Asset table has:
// primary key assetId, durationSeconds,

// Commits table
// primary key commitID, parentCommitID , commitState jsonb, projectID,
// all project branches will be

// CommitState represents the state of a commit of a project - which combines all of the assets associated with a project. Will be at millisecond resolution

/*
Commit state json:

{
sections:
	[
		{
			startOffsetMillis: X
			endOffsetMillis: Y
			assets: {
				video: 	{ assetID, startOffsetInVideo }
				audio: { assetID, endOffsetInVideo } - if audio is included audio will overwrite video audio
				image: { assetID, pos?: { leftCorner: { px, py }, size: A   } - if image included without video, will show image for duration, if included with video, then expected to have pos field set
				text: { assetID, leftCorner: { px , py }, textSize, overlayColor: [black, white, clear] }

			}
		},

	]
}

This is going to be a valtio store on the frontend

*/