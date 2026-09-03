Created by 张周玺, last modified on 八月 28, 2024

##   [1. 总述](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#1-%E6%80%BB%E8%BF%B0)  

###   [1.1 需求来源](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#11-%E9%9C%80%E6%B1%82%E6%9D%A5%E6%BA%90)  

  [https://pingcode.yasdb.com/pjm/items/66badbbe66228b94707e39f5](https://pingcode.yasdb.com/pjm/items/66badbbe66228b94707e39f5)    ?    
  #YDBRD-31479 【jdbc】PreparedStatment后支持自适应DDL变更

来源于客户  【博时基金】，使用Springboot + druid + mybatis，druid开启了pool-prepared-statement，删除了表，并重建表，报错YAS-04007 Message：result set metadata changed。

原因是druid把PreparedStatment缓存起来了，中途ddl之后元数据有变化，此时再继续执行报错  YAS-04007 Message：result set metadata changed  ，需要jdbc能支持元数据变化之后继续执行PreparedStatment语句的能力

###   [1.2 调研文档](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#12-%E8%B0%83%E7%A0%94%E6%96%87%E6%A1%A3)  

Oracle不存在这个问题，因为Oracle的prepare是不与服务端交互的，都是执行时才与服务端交互，所以永远没问题。

###   [1.3 需求分析](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#13-%E9%9C%80%E6%B1%82%E5%88%86%E6%9E%90)  

|属性|场景名称|方案设计|关键技术点|特性是否涉及|SR|
|:---|:---|:---|:---|:---|:---|
|功能|查询语句prepare元数据变化后可以继续执行|检测到元数据变化的报错之后，直接重新prepare+execute|是|是|----|
|性能|性能场景1|该场景下关键性能指标通过什么方案满足|是/否|否|----|
|  
|性能场景2|----|是/否|否|----|
|可用性|恢复场景|----|是/否|否|----|
|可靠性|故障场景|----|是/否|否|----|
|可维可测|DFX功能1|----|是/否|否|----|
|  
|DFX功能2|----|是/否|否|----|
|安全|安全场景1|----|是/否|否|----|
|易用性|----|----|是/否|否|----|
|可修改性|----|----|是/否|否|----|
|兼容性|----|----|是/否|否|----|
|周边配合|权限|----|----|否|----|
|周边配合|审计|----|----|否|----|
|周边配合|导入导出工具|----|----|否|----|


###   [1.4 数据字典](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#14-%E6%95%B0%E6%8D%AE%E5%AD%97%E5%85%B8)  

**描述本篇文档中特性的术语集**

|术语|描述|借鉴业界|参考|
|:---|:---|:---|:---|
|术语1|描述|是|业界资料链接|
|术语2|描述|无|原创技术，参考技术设计链接|


###   [1.5 开源依赖](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#15-%E5%BC%80%E6%BA%90%E4%BE%9D%E8%B5%96)  

不涉及。

##   [2. 接口](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#2-%E6%8E%A5%E5%8F%A3)  

  


不涉及新增接口。

##   [3. 规格与约束](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

**只有查询语句面临这个问题，dml，ddl等应该都不存在这个问题。**

##   [4. 特性](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#4-%E7%89%B9%E6%80%A7)  

###   [4.1 ](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#42-%E7%89%B9%E6%80%A7%E5%8A%9F%E8%83%BD%E7%82%B92)    元数据变化后重新执行。

执行时，服务端返回  4007的报错之后，jdbc重新prepare,然后重新执行。

  


  


##   [5. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#5-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

  


测试带参数的prepare语句和不带参数的prepare语句，prepare之后修改表结构或者字段长度类型，然后执行prepare语句，能正常执行不报错就是成功。

##   [6.资料设计章节](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#6%E8%B5%84%E6%96%99%E8%AE%BE%E8%AE%A1%E7%AB%A0%E8%8A%82)  

不涉及资料改动

##   [7.未来规划](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#7%E6%9C%AA%E6%9D%A5%E8%A7%84%E5%88%92)  

说明本方案遗留待解决的问题、下一步需要解决的问题或者未来演进规划。

## Attachments:

[image2024-3-14_15-59-34.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkZmY4OTcwYzJhZjRmNTIxNjM5IiwicmVmX2lkIjoiNjczOTZkZmY1OTNmOTljOWZmMjM4MTRhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEzNDQ4LCJleHAiOjE3ODIzOTk4NDh9.3njtXer95Gecj7OWi49IUmlo7N1ZXavGDF67-9sNphQ)

 (image/png)    
