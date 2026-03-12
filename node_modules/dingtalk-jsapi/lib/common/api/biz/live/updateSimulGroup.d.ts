export declare const apiName = "biz.live.updateSimulGroup";
/**
 * 更新联播群 请求参数定义
 * @apiName biz.live.updateSimulGroup
 */
export interface IBizLiveUpdateSimulGroupParams {
    /** 已选群列表 */
    selectedGroups?: string[];
    /** 禁用群列表 */
    disabledGroups?: string[];
    /** 可选择群的上限，不填默认45 */
    upperLimitCount?: number;
    /** 标题，不填默认是“添加联播群” */
    title?: string;
}
/**
 * 更新联播群 返回结果定义
 * @apiName biz.live.updateSimulGroup
 */
export interface IBizLiveUpdateSimulGroupResult {
    result: {
        cid: string;
        conversationName: string;
    }[];
}
/**
 * 更新联播群
 * @apiName biz.live.updateSimulGroup
 * @supportVersion ios: 6.0.16 android: 6.0.16
 * @author Android：海牛 iOS：钧鸿
 */
export declare function updateSimulGroup$(params: IBizLiveUpdateSimulGroupParams): Promise<IBizLiveUpdateSimulGroupResult>;
export default updateSimulGroup$;
