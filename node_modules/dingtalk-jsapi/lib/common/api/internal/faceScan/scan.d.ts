export declare const apiName = "internal.faceScan.scan";
/**
 * 人脸识别 请求参数定义
 * @apiName internal.faceScan.scan
 */
export interface IInternalFaceScanScanParams {
    [key: string]: any;
}
/**
 * 人脸识别 返回结果定义
 * @apiName internal.faceScan.scan
 */
export interface IInternalFaceScanScanResult {
    [key: string]: any;
}
/**
 * 人脸识别
 * @apiName internal.faceScan.scan
 * @supportVersion  ios: 3.4.6 android: 3.4.6
 */
export declare function scan$(params: IInternalFaceScanScanParams): Promise<IInternalFaceScanScanResult>;
export default scan$;
