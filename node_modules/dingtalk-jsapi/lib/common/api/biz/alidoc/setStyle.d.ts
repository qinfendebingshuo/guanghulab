export declare const apiName = "biz.alidoc.setStyle";
/**
 * 控制钉钉文档容器内的原生工具栏 请求参数定义
 * @apiName biz.alidoc.setStyle
 */
export interface IBizAlidocSetStyleParams {
    [key: string]: any;
}
/**
 * 控制钉钉文档容器内的原生工具栏 返回结果定义
 * @apiName biz.alidoc.setStyle
 */
export interface IBizAlidocSetStyleResult {
    [key: string]: any;
}
/**
 * 控制钉钉文档容器内的原生工具栏
 * @apiName biz.alidoc.setStyle
 * @supportVersion ios: 5.1.35 android: 5.1.35
 * @author Android：吾贤 iOS：弘煜
 */
export declare function setStyle$(params: IBizAlidocSetStyleParams): Promise<IBizAlidocSetStyleResult>;
export default setStyle$;
