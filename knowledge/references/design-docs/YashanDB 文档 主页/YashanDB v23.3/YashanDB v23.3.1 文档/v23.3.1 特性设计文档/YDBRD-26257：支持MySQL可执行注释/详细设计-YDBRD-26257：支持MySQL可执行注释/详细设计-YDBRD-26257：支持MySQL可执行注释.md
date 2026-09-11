Created by 赵忠源, last modified on 十月 15, 2024

*SR链接：*    [https://pingcode.yasdb.com/pjm/items/66190c75fd997db58ad88713](https://pingcode.yasdb.com/pjm/items/66190c75fd997db58ad88713)    *?*    
  *#YDBRD-26257 支持MySQL可执行注释*

##   [1. 总述](#1-总述)  

支持mysql可执行注释功能，对于/* */内的内容返回执行成功

###   [1.1 需求来源](#11-需求来源)  

【需要描述】MySQL特定格式的注释，会在MySQL（或MySQL特定版本中执行），称为可执行注释

```
/*!40001 SQL_NO_CACHE */
/*!40101 SET NAMES binary*/
/*!40103 SET TIME_ZONE='+00:00' */
/*!40108 WITH CONSISTENT SNAPSHOT */
/*!80003 SET SESSION information_schema_stats_expiry = 0 */
"/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */
/*!40100 SET @@SQL_MODE='' */
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */
/*!40101 SET character_set_client = @saved_cs_client */
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */
/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */
/*!40101 SET @saved_cs_client = @@character_set_client */
/*!40101 SET SQL_MODE=@OLD_SQL_MODE */
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */
/*!40103 SET TIME_ZONE='+00:00' */
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */
/*!50503 SET character_set_client = utf8mb4 */
/*!50503 SET NAMES utf8mb4 */
/*!80000 SET SESSION information_schema_stats_expiry=0 */"
"/*!40101 SET NAMES binary*/
/*!40101 SET SESSION SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO' */
/*!40101 SET SQL_MODE='NO_AUTO_VALUE_ON_ZERO,ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION'*/
/*!40103 SET TIME_ZONE='+00:00' */
/*!40108 WITH CONSISTENT SNAPSHOT */
/*!40114 SET SESSION FOREIGN_KEY_CHECKS = 0 */
/*!40114 SET SESSION UNIQUE_CHECKS = 0 */
) /*!50100 TABLESPACE `mysql` */ ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb3 ROW_FORMAT=DYNAMIC COMMENT='Components'


```

【需求规格】语法兼容，执行时返回Success，实际不生效

###   [1.2 调研文档](#12-调研文档)  

  [https://conf.yasdb.com/pages/resumedraft.action?draftId=135612451&draftShareId=b7c358ca-8831-4316-b4c7-15b467da8152&](https://conf.yasdb.com/pages/resumedraft.action?draftId=135612451&draftShareId=b7c358ca-8831-4316-b4c7-15b467da8152&)  

###   [1.3 需求分析](#13-需求分析)  

1.适配/**/表示注释2.注释可以出现在任意位置，但不生效

**CHECKLIST，正式设计文档需要关注**

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|---|---|---|---|---|
|功能|适配/**/表示注释|修改parse解析流程|是/否|是/否|
|性能|性能场景1|该场景下关键性能指标通过什么方案满足|是/否|是/否|
|可用性|恢复场景|----|是/否|是/否|
|可靠性|故障场景|----|是/否|是/否|
|可维可测|DFX功能1|----|是/否|是/否|
|安全|安全场景1|----|是/否|是/否|
|易用性|----|----|是/否|是/否|
|可修改性|----|----|是/否|是/否|
|兼容性|----|----|是/否|是/否|
|周边配合|权限|----|----|是/否|
|周边配合|审计|----|----|是/否|
|周边配合|导入导出工具|----|----|是/否|


##   [2. 接口](#2-接口)  

```
	static CodResult myLexReadComment(Lexer* lexer, LangWord* word, CodBool* isOverride);
	static CodResult myParseComment(AnlStmt* stmt, Lexer* lexer, LangWord* word);

```

|接口|接口表现|接口说明|是否涉及|
|---|---|---|---|
|SQL语法|语法分支1描述|----|是/否|
|SQL语法|语法分支2描述|----|是/否|
|函数|参数/返回值描述|----|是/否|
|高级包|高级包子对象描述|----|是/否|
|系统视图|视图域段描述|----|是/否|
|动态视图|视图域段描述|----|是/否|
|配置参数|配置参数作用、生效方式|----|是/否|
|驱动接口|驱动对外提供接口描述|----|是/否|
|错误码|错误码、ACTION描述|----|是/否|
|告警|告警描述|----|是/否|
|日志|日志触发条件、等级、事件描述|----|是/否|


##   [3. 规格与约束](#3-规格与约束)  

mysql -c 开启与不开启时服务端接收存在差异

对于/**/的注释

开启时，客户端不会将注释删除，保留并发送到服务端

关闭时，客户端将注释删除，处理后发送到服务端

对于/  *!*  /的注释，无论开启关闭，都将原sql保留并发送到服务端

1. 注释内语句并不生效
1. 仅关注mysql客户端连接yasdb场景
1. yasql下对于全句为块注释会过滤，mysql开启-c时不会
1. 注释中带分号在客户端将被解析为两条语句，报错同;分隔的两条语句报错


##   [4. 特性](#4-特性)  

###   [4.1 支持可执行注释](#41-支持可执行注释)  

1. 修改ParseComment，适配目前识别差异各场景（详见调研文档）
1. 修改解析流程，在任意位置都可以执行


##   [5. Testcases（自测用例）](#5-testcases自测用例)  

设计开发人员自测用例（文字描述），给出开发者自测试的设计方案表格或者XMIND、开发自测的用例归档路径。

自测关注点：

1. 覆盖全面
1. 避免重复测试
1. 测试用例的可维护性


自测用例设计方法：

1. 边界值
1. 等价类
1. 正交


##   [6.资料设计章节](#6资料设计章节)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [7.未来规划](#7未来规划)  

说明本方案遗留待解决的问题、下一步需要解决的问题或者未来演进规划。

## Comments:

|  [](null)  ,评审纪要信息：    
  1.可执行注释保持与注释相同，不校验版本指示器、不实现可执行功能    
  2.mysql 客户端开启-c情况下连接yasdb，结果须与mysql一致,Posted by zhaozhongyuan at 八月 12, 2024 10:26|
|---|
