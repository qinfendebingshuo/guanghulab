export declare const apiName = "internal.faceScan.prepareScan";
/**
 * 人脸识别准备，成功后再调用scan 请求参数定义
 * @apiName internal.faceScan.prepareScan
 */
export interface IInternalFaceScanPrepareScanParams {
    [key: string]: any;
}
/**
 * 人脸识别准备，成功后再调用scan 返回结果定义
 * @apiName internal.faceScan.prepareScan
 */
export interface IInternalFaceScanPrepareScanResult {
    [key: string]: any;
}
/**
 * 人脸识别准备，成功后再调用scan
 * @apiName internal.faceScan.prepareScan
 * @supportVersion  ios: 3.4.6 android: 3.4.6
 */
export declare function prepareScan$(params: IInternalFaceScanPrepareScanParams): Promise<IInternalFaceScanPrepareScanResult>;
export default prepareScan$;
