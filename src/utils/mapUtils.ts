
export const getMapUrl = (mapUid: string): string => {
    return `https://trackmania.exchange/s/tr/${mapUid}`;
};

// Pattern provided by user: https://core.trackmania.nadeo.live/maps/{mapId}/thumbnail.jpg
export const getMapThumbnailUrl = (mapId: string): string => {
    return `https://core.trackmania.nadeo.live/maps/${mapId}/thumbnail.jpg`;
};

export const getTrackmaniaIoUrl = (mapUid: string): string => {
    return `https://trackmania.io/#/leaderboard/${mapUid}`;
};

export const getMapDownloadUrl = (mapUid: string): string => {
    return `https://trackmania.exchange/maps/download/${mapUid}`;
}
