export declare const apiName = "biz.live.chooseLiveGroup";
/**
 * 调起选人组件，选择可以分享大直播的群 请求参数定义
 * @apiName biz.live.chooseLiveGroup
 */
export interface IBizLiveChooseLiveGroupParams {
    [key: string]: any;
}
/**
 * 调起选人组件，选择可以分享大直播的群 返回结果定义
 * @apiName biz.live.chooseLiveGroup
 */
export interface IBizLiveChooseLiveGroupResult {
    [key: string]: any;
}
/**
 * 调起选人组件，选择可以分享大直播的群
 * @apiName biz.live.chooseLiveGroup
 * @supportVersion pc: 4.5.5
 */
export declare function chooseLiveGroup$(params: IBizLiveChooseLiveGroupParams): Promise<IBizLiveChooseLiveGroupResult>;
export default chooseLiveGroup$;
