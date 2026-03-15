export declare const apiName = "device.handwriting.changeSlatePosition";
/**
 * 更新手签控件位置，随网页位置变化 更新手签控件位置 请求参数定义
 * @apiName device.handwriting.changeSlatePosition
 */
export interface IDeviceHandwritingChangeSlatePositionParams {
    /** 手写相对于h5页面的位置信息 */
    ratio: string;
}
/**
 * 更新手签控件位置，随网页位置变化 更新手签控件位置 返回结果定义
 * @apiName device.handwriting.changeSlatePosition
 */
export interface IDeviceHandwritingChangeSlatePositionResult {
}
/**
 * 更新手签控件位置，随网页位置变化 更新手签控件位置
 * @apiName device.handwriting.changeSlatePosition
 * @supportVersion ios: 4.3.7 android: 4.3.7
 */
export declare function changeSlatePosition$(params: IDeviceHandwritingChangeSlatePositionParams): Promise<IDeviceHandwritingChangeSlatePositionResult>;
export default changeSlatePosition$;
