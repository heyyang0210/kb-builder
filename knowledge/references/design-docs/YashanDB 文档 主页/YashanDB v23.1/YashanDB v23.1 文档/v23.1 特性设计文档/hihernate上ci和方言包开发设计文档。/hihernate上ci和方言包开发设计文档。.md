Created by 张周玺, last modified on 五月 11, 2023

##   [1. Overview（概述）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#1-overview%E6%A6%82%E8%BF%B0)  

为了增强崖山jdbc驱动对hibernate框架的支持程度，需要开发针对hibernate的方言包。并且·新建一个ci工程，使用hibernate全量用例，对jdbc驱动，数据库，方言包三者进行看护。    [[YDBRD-13078] 【驱动】JDBC支持hibernate jpa测试集上CI和方言包开发 - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-13078)  

##   [2. Features（功能特性）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#2-features%E5%8A%9F%E8%83%BD%E7%89%B9%E6%80%A7)  

支持功能：

开发针对hibernate的方言包，用来支持hibernate框架使用崖山数据库和驱动进行业务开发。

  


##   [3. Interfaces（接口）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#3-interfaces%E6%8E%A5%E5%8F%A3)  

对 hibernate框架官方提供的Dialect类的部分接口方法进行重写，用来适配崖山的sql语法。（接口范围待全量用例分析完成后才能确定，测试不需要关心方言包的接口，只需要关注hibernate常见功能正常可用）

所有方言包都是继承自基类Dialect.java，全量接口及接口说明见Dialect.java类里面的方法注释。

我们语法与Oracle相似度比较高，所以直接copy了Oracle的方言包OracleDialect.java，在此基础上修改不适配的地方。

## 我们需要实现的接口：

|接口|备注|
|---|---|
|getLimitHandler|  
|
|getAddForeignKeyConstraintString|  
|
|getSqlAstTranslatorFactory|  
|
|columnType|  
|
|contributeTypes|  
|
|getMaxVarcharLength|  
|
|getFloatPrecision|  
|
|getNationalizationSupport|  
|
|appendDateTimeLiteral|  
|


## 原来Oracle重写了而我们需要走默认的接口：

  


|接口|备注|
|---|---|
|getIdentityColumnSupport|  
|
|supportsRecursiveCTE|  
|
|getTimeZoneSupport|  
|
|timestampdiffPattern|  
|
|getAggregateSupport|  
|


##   [4. Limitations（功能限制）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#4-limitations%E5%8A%9F%E8%83%BD%E9%99%90%E5%88%B6)  

数据库、驱动未实现的功能，或者原有的缺陷均没办法通过方言的方式进行弥补，把相关用例屏蔽掉。

  


  [三方框架兼容性问题分析。 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=104219656)  

##   [5. Detail Design（详细设计）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#5-detail-design%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)  

*方案设计的详细说明，包括但不限于方案选型、方案所依赖的技术/第三方组件的原理或背景介绍、关键技术点、方案折衷的考量、可靠性分析、兼容性分析。可以根据需要增删小节。*

hibernate代码以及全量用例：    [CoD-X / hibernate-jpa-ci · GitLab (yasdb.com)](https://git.yasdb.com/cod-x/hibernate-jpa-ci)  

hibernate的demo工程     [CoD-X / jdbc-hibernate-jpa · GitLab (yasdb.com)](https://git.yasdb.com/cod-x/jdbc-hibernate-jpa)  

  


## .

##   [6. Testcases（自测用例）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#6-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

  


开发完成后补充。    
  测试建议：    
  这个需求要求测试人员对hibernate框架有较高的理解程度，我这里建议测试从两方面去考虑本次测试的重点：    
  1、根据hibernate全量用例，对我屏蔽掉的用例的合理性进行分析，如果认为某个用例明显的不应该屏蔽，而是应该通过方言包解决的，可以提出来一起探讨。    
  2、根据我提供的hibernate的demo工程，在demo工程的基础上自己增加用例，来测试方言包的完善性。    
    
  测试重点放在以下三种情况的自动建表和增删改查：    
  1、包含咱们数据库已支持的各种数据类型。    
  2、包含一对多，多对多，一对一等表关联关系。    
  3、主键，自增主键和自动生成主键，包括其他索引。    
    
  注意增删改查一般包含三类写法：    
  1、标准jpa接口（95%的情况，  **重点测试**  ）。    
  2、使用hibernate的HQL（针对复杂查询关系，但sql好写的情况.）。    
  3、CriteriaBuilder（针对sql复杂，但是Java逻辑清晰，或者开发人员不会写SQL时会采用这种用法）。    
    
    


##   [7. Workload（工作量）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#7-workload%E5%B7%A5%E4%BD%9C%E9%87%8F)  

  


*评估代码量KLOC、工作量（人天）。*

  


  


##   [8. TODO（遗留问题）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#8-todo%E9%81%97%E7%95%99%E9%97%AE%E9%A2%98)  

*说明本方案遗留的问题或下一步需要解决的问题。*

不涉及。

## Attachments:

[Dialect.java](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhMzRhMWFkOWEzMzExZGM3YjhiIiwicmVmX2lkIjoiNjczOTZhMzQ3MjgyMDZlZmI5MmVmYmExIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjExNjg5LCJleHAiOjE3ODIyOTgwODl9.wLURhcQt4RI7csp3YNp1rOJ0XNj_OTkVSwBq_-hgJo0)

 (text/x-java-source)    


[OracleDialect.java](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhMzRhMWFkOWEzMzExZGM3YjhjIiwicmVmX2lkIjoiNjczOTZhMzQ3MjgyMDZlZmI5MmVmYmExIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjExNjg5LCJleHAiOjE3ODIyOTgwODl9.6-tfewXsKqVqSuMbW1mqNz6FdcdWHPRhW4iG00Y7SWo)

 (text/x-java-source)    
