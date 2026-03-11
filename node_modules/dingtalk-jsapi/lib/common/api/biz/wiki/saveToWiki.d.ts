export declare const apiName = "biz.wiki.saveToWiki";
/**
 * 将文本或其他格式文档保存到知识库 请求参数定义
 * @apiName biz.wiki.saveToWiki
 */
export interface IBizWikiSaveToWikiParams {
    /** 归属企业，不传将选择主企业 */
    corpId: string;
    /** 弹窗标题 */
    title: string;
    /** 资源存储地址 */
    resourceUrl: string;
    /** 资源类型,目前只支持字符串text */
    resourceType: string;
    /** 导入后的知识页标题 */
    resourceName: string;
}
/**
 * 将文本或其他格式文档保存到知识库 返回结果定义
 * @apiName biz.wiki.saveToWiki
 */
export interface IBizWikiSaveToWikiResult {
    /** 保存后的知识页id */
    id: string;
}
/**
 * 将文本或其他格式文档保存到知识库
 * @apiName biz.wiki.saveToWiki
 * @supportVersion ios: 5.1.5 android: 5.1.5
 * @author Android：吾贤 iOS：弘煜
 */
export declare function saveToWiki$(params: IBizWikiSaveToWikiParams): Promise<IBizWikiSaveToWikiResult>;
export default saveToWiki$;
