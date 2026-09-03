Created by 郑思远, last modified on 五月 30, 2023

# 1.   **概述**

本文描述支持hibernate方言包开发的功能测试设计

  [YDBRD-13078](https://jira.yasdb.com/browse/YDBRD-13078?src=confmacro)    **-**  **【驱动】JDBC支持hibernate jpa测试集上CI和方言包开发**  **完成**

开发设计文档：

  [hihernate上ci和方言包开发设计文档。 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=109586608)  

# 2.   **需求分析**

hibernate是面向对象的java和关系型数据库之间映射的一种解决方案；

hibernate是一个开源的、比较流行的、供企业使用的开发框架；

hibernate在jdbc的基础上做封装，框架可以对接不同的数据库；

hibernate框架对数据库的操作能力有限，ddl仅支持表、索引、约束、序列；且建对象的操作不够精细，比如无法指定tac表；hibernate使用的重点在于查询；

hibernate可以操纵的元数据见官方文档：    [Hibernate ORM 6.2.2.Final User Guide (jboss.org)](https://docs.jboss.org/hibernate/orm/6.2/userguide/html_single/Hibernate_User_Guide.html#schema-generation)  

方言包是hibernate框架和数据库之间的适配，不同数据库需要适配不同的方言包；比如yashan有boolean、time类型，Oracle没有，所以java类型和数据库类型的映射需要不同的方言包；

本SR开发的特性是方言包，但用户直接使用的是hibernate开发框架；站在用户的角度，应当测试配置yashan数据库时，hibernate框架的使用质量，从而测试开发的方言包是否满足需要。

本SR还有一个任务是hibernate jpa测试集上CI：1）开源的hibernate工程本身带有上万个测试用例；2）此处的CI指的是开发的门禁CI，测试工程未要求添加。

hibernate框架目前支持的映射：1.java类和数据库表的映射；2.java类型与数据库类型之间的映射

Hibernate may not be the best solution for data-centric applications that only use stored-procedures to implement the business logic in the database, it is most useful with object-oriented domain models and business logic in the Java-based middle-tier.

Hibernate适用场景是业务中主要是对象模型和商业逻辑，需要使用数据库持久化数据一下的场景；

# 3.   **测试设计方法**

JPA（Java Persistence API）是Java持久化规范，Hibernate是这种规范的一种实现，其他的实现还有MyBatis，Spring Data JPA等；

JPA-2.2接口文档：    [From (javax.persistence-api 2.2 API) (jboss.org)](https://docs.jboss.org/hibernate/jpa/2.2/api/index.html?overview-summary.html)  

本次测试既是一次sr测试，也是一次质量加固。

基于需求分析：    
  1）验证开发禁掉的用例（不支持的功能）是否合理

2）梳理重写的方法进行测试

3）梳理客户常用的功能进行质量加固

4）验证框架建立的对象、数据是否真正持久化到数据库中

# 4.   **详细测试设计**

1）验证功能用例屏蔽是否合理

对屏蔽用例分析：    [三方框架兼容性问题分析。 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=104219656)  

先个人独立分析评估，测试收尾阶段向范瑜(tse)做汇报并作评估，如有争议可以将争议点全部提在一个问题单里做一次ccb。

  


2）测试java类型到数据库类型的映射

|  
|Java primitive types|Hibernate doc type|测试结果（郑）(hibernate5.0.12)|Oracle罗爽(hibernate 4.2.3)|Oracle郑（hibernate 5.4）|是否需要讨论|备注|
|---|---|---|---|---|---|---|---|
|1|#### Enums|in a number of different ways|RAW(255)|RAW(255)|RAW(255)|  
|  
|
|2|#### Boolean|BOOLEAN|BOOLEAN|NUMBER(1)|Number(1)|  
|  
|
|3|#### Byte|TINYINT|TINYINT|NUMBER(3)|NUMBER|  
|  
|
|4|#### Short|SMALLINT|SMALLINT|NUMBER(5)|NUMBER(5)|  
|  
|
|5|#### Integer|INTEGER|INTEGER|NUMBER(10)|NUMBER(10)|  
|  
|
|6|#### Long|  `BIGINT`     |BIGINT|NUMBER(19)|NUMBER(19)|  
|  
|
|7|#### BigInteger|  `NUMERIC`     |NUMBER(19,2)|NUMBER(19,2)|NUMBER(19,2)|  
|  
|
|8|#### Double|  `DOUBLE`    ,       `FLOAT`    ,       `REAL`       or       `NUMERIC`  |DOUBLE|FLOAT(126)|FLOAT(126)|  
|  
|
|9|#### Float|  `FLOAT`    ,       `REAL`       or       `NUMERIC`  |FLOAT|FLOAT(126)|FLOAT(126)|  
|  
|
|10|#### BigDecimal|  `NUMERIC`     |NUMBER(19,2)|NUMBER(19,2)|NUMBER(19,2)|  
|  
|
|11|#### Character|  `CHAR`     |CHAR(255)|CHAR(1 CHAR)|CHAR(1)|是|  
|
|12|#### String|  `VARCHAR`     |VARCHAR(255 CHAR)|VARCHAR2(255 CHAR)|VARCHAR2(255)|是|  
|
|13|#### Character arrays|  `VARCHAR`     |VARCHAR(255 CHAR)|VARCHAR2(255 CHAR)|VARCHAR2(255)|是|  
|
|14|#### Clob / NClob|  `CLOB/NCLOB`     |CLOB/    `NCLOB`     报错|CLOB|CLOB/NCLOB|  
|  
|
|15|#### Byte array|  `VARBINARY`     |BLOB|BLOB|BLOB|  
|  
|
|16|#### Blob|BLOB|BLOB|BLOB|BLOB|  
|  
|
|17|#### Duration|  `NUMERIC`     |BIGINT|RAW(255)|NUMBER(19)|是|  
|
|18|#### Instant|  `TIMESTAMP_UTC`     |TIMESTAMP|RAW(255)|DATE|  
|  
|
|19|#### LocalDate|  `DATE`     |DATE|RAW(255)|DATE|  
|  
|
|20|#### LocalDateTime|  `TIMESTAMP`     |TIMESTAMP|RAW(255)|DATE|  
|  
|
|21|#### LocalTime|  `TIME`     |TIME|RAW(255)|DATE|  
|  
|
|22|#### OffsetDateTime|  `TIMESTAMP`       or       `TIMESTAMP_WITH_TIMEZONE`  |TIMESTAMP|RAW(255)|DATE|  
|  
|
|23|#### OffsetTime|  `TIME`       or       `TIME_WITH_TIMEZONE`  |TIME|RAW(255)|DATE|  
|  
|
|24|#### TimeZone|  `VARCHAR`     |VARCHAR(255 CHAR)|VARCHAR2(255 CHAR)|VARCHAR2(255)|是|  
|
|25|#### ZonedDateTime|  `TIMESTAMP`       or       `TIMESTAMP_WITH_TIMEZONE`  |TIMESTAMP|RAW(255)|DATE|  
|  
|
|26|#### ZoneOffset|  `VARCHAR`     |RAW(255)|RAW(255)|RAW(255)|  
|  
|
|27|#### Calendar|TIMESTAMP|TIMESTAMP|TIMESTAMP(6)|DATE|  
|  
|
|28|#### Date|DATE|DATE|DATE|DATE|  
|  
|
|29|#### Time|TIME|TIME|DATE|DATE|  
|  
|
|30|#### Timestamp|TIMESTAMP|TIMESTAMP|TIMESTAMP(6)|DATE|  
|  
|
|31|#### Class|  `VARCHAR`     |VARCHAR(255 CHAR)|VARCHAR2(255 CHAR)|VARCHAR2(255)|是|  
|
|32|#### Currency|  `VARCHAR`     |VARCHAR(255 CHAR)|VARCHAR2(255 CHAR)|VARCHAR2(255)|是|  
|
|33|#### Locale|  `VARCHAR`     |VARCHAR(255 CHAR)|VARCHAR2(255 CHAR)|VARCHAR2(255)|是|  
|
|34|#### UUID|he SQL type     UUID     or in binary form with the     BINARY     JDBC type|RAW(255)|RAW(255)|报错|是|  
|
|35|#### InetAddress|  `INET`     |RAW(255)|RAW(255)|RAW(255)|  
|  
|
|36|#### JSON mapping|```
<span class="pln" style="color: rgb(0,0,0);">JSON </span>
```|hibernate 5.6不支持|  
|hibernate 5.6不支持|  
|  
|


对每个java类型进行测试并与oracle对比

写HQL查询验证

  


3）测试建立数据库对象

|  
|对象|备注|
|---|---|---|
|1|table|  
|
|2|check约束|  
|
|3|unique约束|  
|
|4|主键|  
|
|5|外键|  
|
|6|Default value|  
|
|7|索引|  
|


  


4）测试java类和类之间的关系

|Associations|备注|
|---|---|
|@ManyToOne|  
|
|@OneToMany|  
|
|@OneToOne|  
|
|@ManyToMany|  
|


  


5）方言包重写接口，由开发提供日志观察是否走到开发的代码

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


  
  注意增删改查一般包含三类写法：    
  1、标准jpa接口（95%的情况，  **重点测试**  ）。    
  2、使用hibernate的HQL（针对复杂查询关系，但sql好写的情况.）。    
  3、CriteriaBuilder（针对sql复杂，但是Java逻辑清晰，或者开发人员不会写SQL时会采用这种用法）。

  


6）hibernate.hbm2ddl.auto参数验证

|参数|结果|备注|
|---|---|---|
|create|符合预期|  
|
|create-drop|用例执行完表没drop|  
|
|update|运行报错,Error creating bean with name 'requestMappingHandlerAdapter' defined in class path resource|  
|
|validate|运行报错,Error creating bean with name 'requestMappingHandlerAdapter' defined in class path resource|  
|


  


# 5.   **测试用例**

测试设计细化后的文本用例

详见附件

# 6.   **测试框架设计**

使用hibernate-jpa-ci工程中带的testng框架；自动化测试用例添加在这个工程中

# 7.   **测试环境说明**

测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等

  


  


## Comments:

|  [](null)  ,hibernate官方文档：,  [https://docs.jboss.org/hibernate/orm/6.2/userguide/html_single/Hibernate_User_Guide](https://docs.jboss.org/hibernate/orm/6.2/userguide/html_single/Hibernate_User_Guide)  ,Posted by zhengsiyuan at 五月 15, 2023 17:54|
|---|
|  [](null)  ,支持的hibernate 5.0-5.6,Posted by zhengsiyuan at 五月 16, 2023 15:35|
|  [](null)  ,测试工程是否需要添加？,Posted by zhengsiyuan at 五月 16, 2023 15:42|
|  [](null)  ,数据类型，边界值，空、浮点数、精度,Posted by zhengsiyuan at 五月 16, 2023 16:07|
|  [](null)  ,关联关系异常的用例,Posted by zhengsiyuan at 五月 16, 2023 16:09|
|  [](null)  ,关系异常hql编译都过不去,Posted by zhengsiyuan at 五月 25, 2023 16:33|
