import { ICommonAPIParams } from '../../constant/types';
/**
 * 扫码 请求参数定义
 * @apiName scan
 */
export interface IUnionScanParams extends ICommonAPIParams {
    type: string;
}
/**
 * 扫码 返回结果定义
 * @apiName scan
 */
export interface IUnionScanResult {
    code: string;
}
/**
 * 扫码
 * @apiName scan
 */
export declare function scan$(params: IUnionScanParams): Promise<IUnionScanResult>;
export default scan$;
