Created by 张周玺, last modified on 十二月 12, 2023

##   [1. Overview（概述）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#1-overview%E6%A6%82%E8%BF%B0)  

  [[YDBRD-20702] JDBC支持java.sql.DatabaseMetaData接口的特定方法 - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-20702)  

##   [2. Features（功能特性）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#2-features%E5%8A%9F%E8%83%BD%E7%89%B9%E6%80%A7)  

支持JDBC接口java.sql.DatabaseMetaData里面两个UDT相关接口getUDTs(String catalog,String schemaPattern, String typeNamePattern,int[] types)和  getSuperTypes(String catalog,String schemaPattern,String typeNamePattern)

##   [3. Interfaces（接口）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#3-interfaces%E6%8E%A5%E5%8F%A3)  

1、支持JDBC接口java.sql.DatabaseMetaData方法getUDTs(String catalog,String schemaPattern, String typeNamePattern,int[] types)    
  2、支持JDBC接口java.sql.DatabaseMetaData方法getSuperTypes(String catalog,String schemaPattern,String typeNamePattern)

##   [4. Limitations（功能限制）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#4-limitations%E5%8A%9F%E8%83%BD%E9%99%90%E5%88%B6)  

无

##   [5. Detail Design（详细设计）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#5-detail-design%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)  

### 【实现如下两个接口】

- #### getUDTs
-   [ResultSet](https://docs.oracle.com/javase/8/docs/api/java/sql/ResultSet.html)     getUDTs(    [String](https://docs.oracle.com/javase/8/docs/api/java/lang/String.html)     catalog,     [String](https://docs.oracle.com/javase/8/docs/api/java/lang/String.html)     schemaPattern,     [String](https://docs.oracle.com/javase/8/docs/api/java/lang/String.html)     typeNamePattern, int[] types) throws     [SQLException](https://docs.oracle.com/javase/8/docs/api/java/sql/SQLException.html)  
- 用如下sql来实现：  select null as TYPE_CAT,owner as TYPE_SCHEM , TYPE_NAME, null as class_name,2002 as DATA_TYPE,null as REMARKS,null as BASE_TYPE from all_types


  


- #### getSuperTypes
-   [ResultSet](https://docs.oracle.com/javase/8/docs/api/java/sql/ResultSet.html)     getSuperTypes(    [String](https://docs.oracle.com/javase/8/docs/api/java/lang/String.html)     catalog,     [String](https://docs.oracle.com/javase/8/docs/api/java/lang/String.html)     schemaPattern,     [String](https://docs.oracle.com/javase/8/docs/api/java/lang/String.html)     typeNamePattern) throws     [SQLException](https://docs.oracle.com/javase/8/docs/api/java/sql/SQLException.html)  
- 用如下sql来实现：select null as TYPE_CAT,owner as TYPE_SCHEM , TYPE_NAME, null as SUPERTYPE_CAT,SUPERTYPE_OWNER as SUPERTYPE_SCHEM , SUPERTYPE_NAME from all_types where SUPERTYPE_NAME   is not null;    



### 【实现细节】

1、对于以上两个接口，参数为null就认为是不作为过滤条件。    
  2、types参数必须为null或者包含2002（  Types.STRUCT）才能查到数据    
  3、查询的UDT仅限object类型（对应Java里面的STRUCT类型）    
  4、schemaPattern和typeNamePattern两个参数不为null时可以进行模糊匹配查询（模糊查询时通配符要自己带）

##   [6. Testcases（自测用例）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#6-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

### 【测试场景】

1. 创建udt,查询udt信息。
1. 创建继承的udt,查询父类型信息。
1. 传模糊字符串，测试模糊查询能力。
1. 创建前缀相同的其它类型（array,nested table），然后模糊查询测试两个接口能否正确返回。
1. 测试接口传null,传空串的情况。


##   [7. Workload（工作量）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#7-workload%E5%B7%A5%E4%BD%9C%E9%87%8F)  

*评估代码量KLOC、工作量（人天）。*

  


##   [8. TODO（遗留问题）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#8-todo%E9%81%97%E7%95%99%E9%97%AE%E9%A2%98)  

*说明本方案遗留的问题或下一步需要解决的问题。*

  
