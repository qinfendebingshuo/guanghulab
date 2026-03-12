import { ICommonAPIParams } from '../../constant/types';
/**
 * 扫名片 请求参数定义
 * @apiName scanCard
 */
export interface IUnionScanCardParams extends ICommonAPIParams {
}
/**
 * 扫名片 返回结果定义
 * @apiName scanCard
 */
export interface IUnionScanCardResult {
    NAME: string;
    IMAGE: string;
    PHONE: string;
    MPHONE: string;
    ADDRESS: string;
    COMPANY: string;
    POSITION: string;
}
/**
 * 扫名片
 * @apiName scanCard
 */
export declare function scanCard$(params: IUnionScanCardParams): Promise<IUnionScanCardResult>;
export default scanCard$;
