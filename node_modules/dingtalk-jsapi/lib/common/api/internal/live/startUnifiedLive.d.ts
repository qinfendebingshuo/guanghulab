export declare const apiName = "internal.live.startUnifiedLive";
/**
 * 直播机构后台微应用唤起主播端接口 请求参数定义
 * @apiName internal.live.startUnifiedLive
 */
export interface IInternalLiveStartUnifiedLiveParams {
    /** 包含直播类型，以及直播的uuid */
    startParam: {
        unifyLiveType: number;
        liveUuid: string;
    };
}
/**
 * 直播机构后台微应用唤起主播端接口 返回结果定义
 * @apiName internal.live.startUnifiedLive
 */
export interface IInternalLiveStartUnifiedLiveResult {
}
/**
 * 直播机构后台微应用唤起主播端接口
 * @apiName internal.live.startUnifiedLive
 * @supportVersion ios: 4.7.1 android: 4.7.1
 */
export declare function startUnifiedLive$(params: IInternalLiveStartUnifiedLiveParams): Promise<IInternalLiveStartUnifiedLiveResult>;
export default startUnifiedLive$;
