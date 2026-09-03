Created by 郝鑫刚, last modified on 七月 31, 2024

  


  [https://pingcode.yasdb.com/pjm/items/6674d51c288e197820aa7b80](https://pingcode.yasdb.com/pjm/items/6674d51c288e197820aa7b80)    ?    
  #YDBRD-29538 支持type的对象级权限

##   [1. 总述](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#1-%E6%80%BB%E8%BF%B0)  

自定义类型除EXECUTE ANY TYPE等系统级权限外，还有三种对象级权限DEBUG、EXECUTE、UNDER，可以单独授权某个TYPE。

DEBUG:：调试type body。  本次不支持  。

EXECUTE：可以使用type以及方法。表列、变量、参数、使用方法。

UNDER：可以在当前类型创建子类型。使用时同时需要EXECUTE权限。

  


###   [1.1 需求来源](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#11-%E9%9C%80%E6%B1%82%E6%9D%A5%E6%BA%90)  

外场需求。普通用户需要使用st_geometry类型。通过把st_geometry 的EXECUTE权限给PUBLIC实现。

支持部署形态为主备、集群。

不支持分布式部署。

不支持行存表。

  


  [SAISSUE-366](https://jira.yasdb.com/browse/SAISSUE-366?src=confmacro)    -  【深智城】普通用户不能建带st_geometry字段类型的表  转需求关闭

###   [1.2 调研文档](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#12-%E8%B0%83%E7%A0%94%E6%96%87%E6%A1%A3)  

  


  


###   [1.3 需求分析](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#13-%E9%9C%80%E6%B1%82%E5%88%86%E6%9E%90)  

**CHECKLIST，正式设计文档需要关注**

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|:---|:---|:---|:---|:---|
|功能|GRANT、REVOKE支持TYPE的对象级权限|增加PRIV_DEBUG、PRIV_EXECUTE、PRIV_UNDER权限。,GRANT时写对象权限到ROLE_OBJPRIVS$、USER_OBJROLES$系统表。|是|是|
|功能|TYPE对象级校验权限|TYPE对象级权限不CACHE。,先校验系统权限，然后查表校验对象权限。|是|是|
|可维可测|*_TAB_PRIVS视图|查询系统表，增加TYPE授权的对象级权限|是|是|
|周边配合|审计：|GRANT、REVOKE TYPE的对象级权限时增加审计。|是|是|
|周边配合|导入导出工具：|导出角色、用户时，同时导出TYPE对象级权限。,导出TYPE时，同时导出对象级权限。|是|是|


  


  


###   [1.4 数据字典](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#14-%E6%95%B0%E6%8D%AE%E5%AD%97%E5%85%B8)  

无。

  


###   [1.5 开源依赖](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#15-%E5%BC%80%E6%BA%90%E4%BE%9D%E8%B5%96)  

无。

  


##   [2. 接口](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#2-%E6%8E%A5%E5%8F%A3)  

  


|接口|接口表现|接口说明|是否涉及|
|:---|:---|:---|:---|
|SQL语法|GRANT object_privilege ON type|  
|是|
|SQL语法|  
|----|是/否|
|错误码|错误码、ACTION描述|  
|  
|


  


##   [3. 规格与约束](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

  


UNDER权限说明：由于1子类型的AUTHID要与父类型一致。2父类型 AUTHID DEFINER时，只能在父类型模式下创建子类型。所以只能在父类型AUTHID CURRENT_USER下用到UNDER权限。

本次UNDER权限保持oracle的限制。即只能在AUTHID CURRENT_USER下有用，但AUTHID CURRENT_USER无作用。

  


规格：

- 对象级权限（DEBUG、EXECUTE、UNDER）只能直接授权，不能通过角色获取。PUBLIC除外，一个TYPE的EXECUTE对象级权限给PUBLIC后，任何用户都可以使用。 评审结论：和ORACLE一致，对象级不能通过ROLE传递。
- EXECUTE ANY TYPE、UNDER ANY TYPE系统级权限也不能通过role传递（CREATE\ALTER\DROP可以）  。 以上两点，表列和存储过程里用报错，但  匿名块可以使用  。评审结论：保持现状。系统级权限可以传递。  
- SQL中用到UDT时，即需要校验权限。和oralce有细节差异。


  


  


约束：

- 不能重复授权。
- 不能一次授权多个权限。eg：GRANT DEBUG, EXECUTE ON typ1 
- 所以权限需完整输入ALL PRIVILEGES。
- 语法上ON object_name字段不支持同义词。
- 当登录用户和TYPE的OWNER不一致时，不会检测角色的权限。
- yasdb上ALL PRIVILEGES和单个对象级权限是独立的。eg：GRANT ALL PRIVILEGES ON typ1 TO u1 WITH GRANT OPTION后，u1不能再授权单独的EXECUTE、UNDER，只能再授权 ALL PRIVILEGES。


  


  


##   [4. 特性](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#4-%E7%89%B9%E6%80%A7)  

  


###   [4.1 GRANT](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#41-%E7%89%B9%E6%80%A7%E8%AE%BE%E8%AE%A1)  

增加权限PRIV_DEBUG、PRIV_EXECUTE。

权限和对象不匹配时报错。

检测是否可以授权。OWNER，GRANT ANY OBJECT PRIVILEGE系统权限，权限WITH GRANT。

将授权信息写如系统表，USER_OBJROLES$、ROLE_OBJPRIVS$、USERAUTH$。

  


TYPE的对象级权限不缓存，但对于user/role的privNum还需要处理。和表有一些差异。（GRANT、REVOKE处理逻辑一致）。

GRANT 时有表操作，没有内存操作。理论上不需要写aux log（文件修改，事务自己同步），不需要发集群消息。

REVOKE时有表操作，有内存的失效操作，有privNum++操作。需要发集群消息，需要写aux log（失效type的udtDc）。

  


并发：

被授权用户加share锁。

type加share锁。

###   [4.2 REVOKE](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#41-%E7%89%B9%E6%80%A7%E8%AE%BE%E8%AE%A1)  

检测是否有回收的权限。

系统表中删除相关信息。

REVOKE FROM USER：相关TYPE加X锁，并置无效。执行完后相关TYPE需要重编译，在重编译时重新校验权限。

REVOKE FROM ROLE：TYPE的对象级权限不能通过ROLE传递（  除非是FROM PUBLIC  ），所以不会有表、FUNCTION等对象用到这个权限，不需要失效相关TYPE。PUBLIC需要单独处理。对于匿名块，有role->privNum检测context的变化。

REVOKE SYS PRIV：context（包括过程体的）有用户权限变化后的校验。

  


- TYPE被表（被授权者模式下）使用时REVOKE对象级权限会报错。
- 被TYPE依赖时，回收权限后，TYPE会变成无效。
- 被TYPE依赖，然后TYPE被表使用，RECOKE时报错。


  


二阶段：    信息中增加objType字段，TYPE对象级授权时，不需要操作udtDc。相关udtDict在事务中失效。

逻辑日志：applyRevokeObjPriv，备机对用户/角色的privNum++、失效当前type的udtDict。

集群：        msgRevoke时对象权限的type，失效udtDict。确保用户/角色的privNum++。

在线恢复：applyRevokeObjPriv发送相关的revoke详细，让其它实例失效udtDict。

锁信息：    REVOKE时获取type和依赖当前type的type锁，执行结束后相关udtDict失效。

升级：       不影响。

  


并发：

回收授权的用户加share锁。

回收权限from user时对type加X锁。

加锁：锁TYPE =》 锁回收用户下依赖此TYPE的TYPE=》失效相关TYPE。

放锁：使用事务的放锁机制。

###   [4.3 权限校验](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#41-%E7%89%B9%E6%80%A7%E8%AE%BE%E8%AE%A1)  

1. 先校验AUTH_EXECUTE_TYPE，使用role权限。
1. 重新设置authInfo，校验对象级权限。TYPE的ALL_PRIVILEGES权限目前实现上是SYS_ROLE，规避处理，直接查询系统表。


  


  


###   [4.4 视图](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#41-%E7%89%B9%E6%80%A7%E8%AE%BE%E8%AE%A1)  

*_TAB_PRIVS中增加TYPE的对象级权限解析、显示。

  


###   [4.5 审计](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#41-%E7%89%B9%E6%80%A7%E8%AE%BE%E8%AE%A1)  

  


审计GRANT、REVOKE的授权、回收TYPE对象级权限动作。

CREATE AUDIT POLICY ap1 ACTIONS ALL/GRANT ON schema.type_name。

  


###   [4.6 导入导出特性设计](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#41-%E7%89%B9%E6%80%A7%E8%AE%BE%E8%AE%A1)  

  


表依赖的TYPE里不包括权限。

复用PUMP_TAG_OBJ_PRIVS的逻辑。

  


导入的GRANT有问题只警告。

|模式|FULL|USER|TABLE|
|---|---|---|---|
|适配点|导出type时导出对象级权限。,导入type时导入对象级权限。|导出type时导出对象级权限。,导入type时导入对象级权限。|只导入和表同用户r的type。,从设计上分析无影响。,  
    
|
|GRANTOR字段|之前实现了通过协议修改登录用户。|||
|级联|先排序。使用之前的逻辑。|||


  


  


是否执行TYPE的对象级权限的导入:

|exp\imp|TABLES|USER|FULL|
|:---|:---|:---|:---|
|TABLES|NA|NA|NA|
|USER|NA|Y|Y|
|FULL|NA|Y|Y|


###   [4.7 场景适配](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#41-%E7%89%B9%E6%80%A7%E8%AE%BE%E8%AE%A1)  

- DROP TYPE 时删除已授权的对象级权限。
- 没有TYPE的EXECUTE权限时，依赖关系也会存在。
- MDSYS.ST_GEOMETRY、MDSYS.BOX2D、MDSYS.GEOMETRY_PATH、MDSYS.GEOMETRY_DUMP、MDSYS.GEOMETRY_DUMP_SET、XA_SYS.DBMS_XA_XID、XA_SYS.DBMS_XA_XID_ARRAY权限给PUBLIC。DBMS_SQL、DBMS_OUTPUT 没有需要给PUBLIC的。


  


##   [5. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#5-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

|  
|  
|实现备注|
|---|---|---|
|视图|TAB_PRIVS视图查询正常。|  
|
|  
|类型存在没权限时，DEPENDENCIES依然有记录。|  
|
|  
|有对象级权限后查all_objects视图。可以查到。|视图里检测SYS.USER_OBJROLES$表的记录。|
|审计|审计GRANT ON TYPE。GRANT/REVOKE。|  
|
|导入导出|full导出，full导入，user导入。|  
|
|  
|user导出，full导入，user导入。|  
|
|  
|导出带type body|  
|
|  
|  
|  
|
|异常语法|TABLE无效权限。|  
|
|  
|对象不存在|  
|
|  
|type无效权限。|  
|
|  
|无效with admin。|  
|
|单用户、单type|under需要权限。|  
|
|  
|under的对象需要是object、not final。|  
|
|  
|under需要在authid current_user下。|  
|
|  
|execute需要权限。|  
|
|  
|table使用type后revoke execute。报错。|  
|
|  
|type使用后revoke execute。失效type。|  
|
|  
|type使用+table使用，报错。|  
|
|  
|  
|  
|
|  
|SET current_schema = u3不影响权限校验。|注意：current_schema影响对象的模式。和登录不一致时，不能用u3的role权限。|
|  
|REVOKE EXECUTE ANY TYPE 后之前的sql不能执行。|context上记录有用到的用户权限、角色权限的privNum，revoke后该值会变化。|
|  
|REVOKE对象权限后，之前缓存的sql不能执行。|type的udtDc会失效。|
|  
|REVOKE的type有同义词。|  
|
|  
|REVOKE under后，类型相关处理和execute一样  。|  
|
|  
|  
|  
|
|  
|GRANT ANY OBJECT PRIVILEGE之后可以grant任何对象级权限|  
|
|单用户 + table|只有table权限。只可以操作非UDT列。|  
|
|  
|只有table权限，可以insert、update udt列为NULL。|  
|
|  
|  
|  
|
|单用户 + nest type +table|只可以查询或使用有权限的udt列。|  
|
|  
|table()里列本身、object成员不需要权限。|  
|
|  
|table()的collection成员需要权限。|  
|
|  
|  
|  
|
|role|系统级权限可以通过role传递。|  
|
|  
|对象级权限可以在匿名块下使用|  
|
|  
|对象级权限在pl和表列不能通过role传递。|  
|
|  
|系统内置类型，gis、xa包类型正常使用。|MDSYS的gis类型，XA_SYS.DBMS_XA_XID、XA_SYS.DBMS_XA_XID_ARRAY|
|  
|revoke角色的type。 匿名块的缓存会失效。|  
|
|  
|revoke from public，需要失效相关type  。|  
|
|  
|  
|  
|
|多role|通过多级role传递的系统权限。|注意：权限校验只能检测登录用户的role。|
|  
|多级role的对象权限可以在匿名块使用。|  
|
|  
|  
|  
|
|多用户|with grant option。才能再次grant。|  
|
|  
|使用with grant option权限grant的，只有grantor可以回收。|  
|
|  
|u1授权后再replace type|  
|
|  
|  
|  
|
|  
|  
|  
|


  


说明：

~~有表有权限，对表列的TYPE无权限：操作中不涉及类型时，操作正常。查询没type或查type属性可以。查询包含TYPE列时报错。~~

~~对TYPE有权限，对TYPE的成员TYPE无权限：不限制使用TYPE，但显示使用成员TYPE时报错。~~

~~对表有权限，对表列TYPE有权限，对表列TYPE的成员TYPE无权限：遵循上面两点。~~

  


  


  


##   [6.资料设计章节](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#6%E8%B5%84%E6%96%99%E8%AE%BE%E8%AE%A1%E7%AB%A0%E8%8A%82)  

GRANT.md

REVOKE.md

对象特权管理.md

  


##   [7.未来规划](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#7%E6%9C%AA%E6%9D%A5%E8%A7%84%E5%88%92)  

  


  
