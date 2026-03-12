import { ICommonAPIParams } from '../../constant/types';
/**
 * 授权引导 请求参数定义
 * @apiName showAuthGuide
 */
export interface IUnionShowAuthGuideParams extends ICommonAPIParams {
    authType: string;
}
/**
 * 授权引导 返回结果定义
 * @apiName showAuthGuide
 */
export interface IUnionShowAuthGuideResult {
    shown: boolean;
}
/**
 * 授权引导
 * @apiName showAuthGuide
 */
export declare function showAuthGuide$(params: IUnionShowAuthGuideParams): Promise<IUnionShowAuthGuideResult>;
export default showAuthGuide$;
