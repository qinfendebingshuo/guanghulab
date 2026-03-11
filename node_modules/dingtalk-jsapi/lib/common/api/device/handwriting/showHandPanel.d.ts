export declare const apiName = "device.handwriting.showHandPanel";
/**
 * 唤起手签控件接口 请求参数定义
 * @apiName device.handwriting.showHandPanel
 */
export interface IDeviceHandwritingShowHandPanelParams {
    /** 初始手写相对于h5页面的位置信息 */
    ratio: string;
}
/**
 * 唤起手签控件接口 返回结果定义
 * @apiName device.handwriting.showHandPanel
 */
export interface IDeviceHandwritingShowHandPanelResult {
    /** 保存图片的本地路径 */
    path: string;
}
/**
 * 唤起手签控件接口
 * @apiName device.handwriting.showHandPanel
 * @supportVersion android: 4.3.7
 */
export declare function showHandPanel$(params: IDeviceHandwritingShowHandPanelParams): Promise<IDeviceHandwritingShowHandPanelResult>;
export default showHandPanel$;
