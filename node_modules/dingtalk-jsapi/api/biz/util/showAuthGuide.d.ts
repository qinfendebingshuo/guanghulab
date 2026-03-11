import { ICommonAPIParams } from '../../../constant/types';
/**
 * 授权引导 请求参数定义
 * @apiName biz.util.showAuthGuide
 */
export interface IBizUtilShowAuthGuideParams extends ICommonAPIParams {
    authType: string;
}
/**
 * 授权引导 返回结果定义
 * @apiName biz.util.showAuthGuide
 */
export interface IBizUtilShowAuthGuideResult {
    shown: boolean;
}
/**
 * 授权引导
 * @apiName biz.util.showAuthGuide
 */
export declare function showAuthGuide$(params: IBizUtilShowAuthGuideParams): Promise<IBizUtilShowAuthGuideResult>;
export default showAuthGuide$;
