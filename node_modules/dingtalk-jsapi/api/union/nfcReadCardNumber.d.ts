import { ICommonAPIParams } from '../../constant/types';
/**
 * 读取NFC芯片物理id 请求参数定义
 * @apiName nfcReadCardNumber
 */
export interface IUnionNfcReadCardNumberParams extends ICommonAPIParams {
}
/**
 * 读取NFC芯片物理id 返回结果定义
 * @apiName nfcReadCardNumber
 */
export interface IUnionNfcReadCardNumberResult {
    content: string;
}
/**
 * 读取NFC芯片物理id
 * @apiName nfcReadCardNumber
 */
export declare function nfcReadCardNumber$(params: IUnionNfcReadCardNumberParams): Promise<IUnionNfcReadCardNumberResult>;
export default nfcReadCardNumber$;
