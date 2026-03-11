export declare const apiName = "internal.requestmoney.generateBizId";
/**
 * 生成群收款的bizId 请求参数定义
 * @apiName internal.requestmoney.generateBizId
 */
export interface IInternalRequestmoneyGenerateBizIdParams {
    [key: string]: any;
}
/**
 * 生成群收款的bizId 返回结果定义
 * @apiName internal.requestmoney.generateBizId
 */
export interface IInternalRequestmoneyGenerateBizIdResult {
    /** 群收款bizId */
    result: string;
}
/**
 * 生成群收款的bizId
 * @apiName internal.requestmoney.generateBizId
 * @supportVersion ios: 4.5.13 android: 4.5.13
 */
export declare function generateBizId$(params: IInternalRequestmoneyGenerateBizIdParams): Promise<IInternalRequestmoneyGenerateBizIdResult>;
export default generateBizId$;
