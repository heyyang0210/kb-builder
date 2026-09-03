Created by 李美娥, last modified on 七月 31, 2024

# 1. 概述

需求：    [https://pingcode.yasdb.com/pjm/items/6674d51c288e197820aa7b80](https://pingcode.yasdb.com/pjm/items/6674d51c288e197820aa7b80)    ?    
  #YDBRD-29538 支持type的对象级权限    
  开发设计：    [特性设计-YDBRD-29538支持type的对象级权限 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=156138950)  

# 2. 需求分析

## 2.1 功能点分析

|语法|功能|
|---|---|
|grant EXECUTE on PersonType to user1;|允许       `user1`       用户对       `PersonType`       对象进行执行操作|
|grant UNDER on PersonType to user1;|允许       `user1`       用户在       `PersonType`       类型之下创建子类型|
|revoke EXECUTE on PersonType from user1;|回收  user1     用户对     PersonType     对象的执行权限|
|revoke UNDER on PersonType to user1;|不允许  user1     用户在     PersonType     类型之下创建子类型|
|GRANT ALL PRIVILEGES ON typ1 TO u1 WITH GRANT OPTION|将typ1的权限，全部给用户u1|


-   `GRANT EXECUTE ON PersonType TO user1;`    允许       `user1`       执行       `PersonType`       类型的方法（如果有），  类型可以是object、varray、table（plsql里面创建或者pkg里面创建的，不支持）
-   `GRANT UNDER ON PersonType TO user1;`    允许       `user1`       在       `PersonType`       类型基础上创建子类型，  只能是object，user1需要有create type的权限和execute on type的权限，type需要带上not final，然后父类型需要是AUTHID CURRENT_USER，不带报错supertypes's AUTHID is DEFINER but supertype and subtype are not in same schema  。父类型是current_user的时候，B用户创建的子类型默认是current_user,指定define报错supertypes's AUTHID is different than subtype's AUTHID
- 权限变更授予的过程中，涉及视图，简单查看，主要查看：


                   DBA_TAB_PRIVS 或 ALL_TAB_PRIVS或USER_TAB_PRIVS 记录授予给用户或角色的对象级权限信息，包括 EXECUTE 权限。

      下面的粗略覆盖：

                   ALL_TAB_PRIVS_RECD记录了当前用户或角色从其他用户或角色那里继承的对象级权限信息。

                   DBA_DEPENDENCIES 如果 Person1Type 类型依赖于其他对象（例如其方法依赖于其他类型），那么在授予或撤销权限时，可能会更新依赖关系。

                   DBA_ROLE_PRIVS如果 user1 是通过角色间接获得了权限，而不是直接通过授予给用户的方式。   

                   all_objects  当前用户可访问的所有对象信息（切换都被赋予权限的用户下使用）

under给user1用户后，仅给under,user1无法创建子类型，需要user1还有create type和execute type的权限，拥有这些权限后，可以父类型定义变量，访问父类型的函数的，把父类型作为表列。

execute给user1用户后，user1可以用父类型定义变量，访问父类型的函数的，可以把父类型作为表列，但是不能在父类型下创建子类型。

create type本身的带的权限相关字段AUTHID CURRENT_USER/DEFINER跟这个特性的  交互点：暂无，yashan是语法适配，默认走的是define的语法。

## 2.2 应用场景

主要场景：前提是有权限执行grant EXECUTE/UNDER on type类型 to 用户

（1）、创建一个用户，grant EXECUTE/UNDER on type类型 to 用户

（2）、创建一个role，把权限给role，然后把role给用户（1、仅给execute on 、under on、create type权限给某个role 2、  any操作权限的角色有（EXECUTE ANY TYPE、UNDER ANY TYPE） ，把这个角色给用户，有execute under权限；）

（3）、给内置的角色public权限EXECUTE/UNDER on type,创建一个用户，给用户session权限后，可以使用type或给type创建子类型

（4）、自定义role，把内置角色给role，比如grant DBA to roleh，然后再role给用户（  内置角色1、resource没有  execute under权限；2、dba有；3、connect没有。  ）

（5）、不通过内置角色，自定义角色，grant赋予权限后，级联给其他用户，看用户是否有权限

（6）、ALTER SESSION SET current_schema=用户名，然后使用type并将type权限给其他用户

（7）、某一个type或者多个type对象嵌套使用或gis的内置类型，单独对一个type赋予权限，对多个type赋予权限（嵌套的，少数会单独一个个grant type权限给用户，会有一种把这些涉及的type权限都给role，后面单独把role给用户）。

## 2.3 规格约束

1  、数据库形态：支持单机（关注备机，execute权限授予后，备机可使用type，  备机不可执行grant revoke命令  ），支持集群，分布式（不支持创建type，不用加拦截，若内置的geom类型支持，可以使用这个类型去拦截--不用管）

# 3. 详细测试设计

## 3.1 测试设计方法

本次测试主要采用等价类、错误推测法进行测试

## 3.2 详细测试设计

### 3.2.1语法测试

（1）  grant EXECUTE on PersonType to user1; 

|接口|测试分类|有效等价类|备注|无效等价类|备注|
|:---|:---|:---|:---|:---|:---|
|  
  grant EXECUTE on PersonType to user1;|语法|1、对象或者用户名全小写（引号处理）,2、对象名或用户大小写混合且含中文,3、对象或者用户名长度是64或1,4、带上  WITH GRANT OPTION|  
|1、type对象不存在,2、用户不存在,3、关键字拼写错误（不支持的with admin）,  
|  
|
||对象类型：自己创建|1、object,2、varray、table,3、多层嵌套,全是自定义的嵌套：,嵌套的都有权限、只有外层有权限、里面public同义词+外层有权限组合（type给了执行权限,pulbic的同义词才可访问）,自定义和内置的嵌套：,4、gis的内置类型：  MDSYS.ST_GEOMETRY、MDSYS.BOX2D、MDSYS.GEOMETRY_PATH、MDSYS.GEOMETRY_DUMP、MDSYS.GEOMETRY_DUMP_SET、XA_SYS.DBMS_XA_XID、XA_SYS.DBMS_XA_XID_ARRAY  --普通用户可以使用这些类型+  dba用户execute、其他普通用户grant execute,5、对应type的私有同义词，  EXECUTE on 同义词后，type和同义词均可使用/给了type权限，同义词不单独给权限，不可以使用同义词,6、对应type创建public同义词，type不给权限，public同义词不能使用(用例UNDER_07_1)|  
|1、plsql对象,2、匿名块里面的type然后动态语句grant权限,3、pkg里面的type，自身的函数去grant权限，grant pkg.type to user（见20）,4、record 、  关联数组(tablex)|报错|
||对象类型：其它用户创建|其他用户的type，执行用户对其有权限，去执行grant或revoke,（2）、2是dba用户，可以直接执行grant和revoke，将用户1的type的execute权限给用户3（3需要带用户名去使用同义词，无法直接同义词的方式使用）（用例13）,(4)1创建type  ，把权限给2，2后面再把权限给3(1带上WITH GRANT OPTION）--用例12,(8)用户1-2-3，回收1-2的，可以回收，3之前依赖1的type间的表、pkg、func不再可用（表不是直接依赖，1可以从2回收权限）(用例12）,(9)用户1-2-3，回收2-3的，不可以回收，3上面有依赖的表，就是3删了表，2也无法回收（回收站开关影响）  （用例12）|  
|其他用户的type，执行用户对其无权限,（1）、1创建type，把权限给2，2后面再把权限给2和3，2对其有execute权限，去执行grant或revoke报错（2是resource角色无权限、2是pulbie角色也无权限）且2自己给自己grant或者revoke，报错–用例12，不带WITH GRANT OPTION,（3）、1用户的type，用户2有GRANT ANY PRIVILEGE和1用户type的execute权限，是resource角色，执行grant或revoke给3用户，报错（用例14）|  
|
||执行用户|有权限,2、直接创建的用户，alter session操作到创建的用户，创建type，并把权限给其他用户(从dba执行alter session的可以执行grant，不可以revoke；resource用户无法grant）,3、拥有内置角色的用户（内置角色的权限不更改情况下）,能创建type的自己创建type+regress给其用户下创建，无法创建的，regress给其用户下创建type,4、拥有内置角色的用户（内置角色权限更改）,比如将create type的权限给内置用户public，然后创建用户（默认用户是pulbic角色），用户创建type并把权限给其他用户，其他角色不测，本身一般不会去改内置角色,5、自定义role，赋予权限，然后role to用户，用户有权使用，但是无法revoke execute，可以revoke role回收权限，DBA_TAB_PRIVS无记录，DBA_ROLE_PRIVS才有记录,6、自定义role，多次级联给其他role，然后其他role to用户，用户再登陆，可以回收role给用户的权限，无法直接1从2用户回收（1的type的权限是给了role，role给的2用户）,7、自定义role，多次级联给其他role，用户登陆，然后再给role权限，grant或者revoke权限都会有滞后性,8、自己给自己成功，自己回收自己报错（type在自己名下）--用例3,自己给自己报错，自己回收自己报错（type不在自己名下，是其他用户grant execute给他的）–用例12,9、登录用户2无权限，alter session的1用户有权限，不能用1的execute权限（15_3)|内置角色：DBA、AUDIT_ADMIN、SECURITY_ADMIN、SYSDBA、SYSOPER、PUBLIC、CONNECT、RESOURCE、SELECT_CATALOG_ROLE、AUDIT_VIEWER,主要关注DBA、PUBLIC、CONNECT、RESOURCE、SELECT_CATALOG_ROLE,7主要是：  grant role to role是延迟生效的，即如果用户A拥有roleA, 用户登录，此时只有roleA。如果此时grant roleB to roleA, 用户A将不会继承roleB角色。只有当用户A退出再连接，或者另起连接才同时拥有roleA,roleB。|(1)6里面级联中的某一个role被删掉：,drop 中间的某个 role执行后，再登陆执行用户去使用，报错,drop role执行后，原有的执行用户的连接，不重新登陆，若删除的是被执行grant execute的role，立即生效，其他的role，不会生效，仍可继续使用,6里面基本中的某一个role权限被回收，验证是否可用，视图相关字段是否清空,(2)type的所有者进行的操作：,type可force重建（被给权限的用户没有创建依赖type的表,存在依赖的type不影响），type对象被删，被给权限的用户不可用，视图相关字段是否清空（用例28）,执行用户：type不可force重建（被给权限的用户创建依赖type的表）28_1|  
|
||被赋予权限的用户|1、未更改权限的内置角色权限的用户（不需要把所有内置角色都测完，默认的是public，前面其他点已经覆盖，测connect、 resource、 dba）：即使dba，也只能匿名块里面使用(29-31),补充sys用户，无法grant execute to sys（31_1),2、被更改权限的内置角色权限的用户，把用户的type的execute权限给了角色，用户是这个角色，默认就有了这个权限（测个public角色）,3、有自定义角色权限的用户,4、是自定义角色级联权限的用户，回收中间段关联的role的权限，也无权使用|  
|  
|  
|
||被赋予权限的用户执行的操作|直接给用户授权：初始化变量（嵌套的，外层有权限，子给null是可以的，只要不单独调度子类型去构造数据）、做表列（还需要建表和对user表空间的使用权限）、访问其函数、  做嵌套类型的里层,通过role授权：仅匿名块可以使用、  plsql和表列要拦截,可force重建|  
|做父类型,drop操作或者alter|报错|
||执行次数|1、将同一对象给同一用户多次（1给2多次，1给2一次，dba把1的给2）  --我们有差异，也不可以,2、将同一对象给多个用户,3、将不同对象（同一用户下的、不同用户下的对象）给同一个用户,4、跨度多个用户，创建嵌套类型：1、1的type给2和3, 2创建嵌套类型type使用了1的type，2再将自己的type权限给3，报错grant option does not exist for 'USER_YDBRD_29538_39_1.OBJ_YDBRD_29538_39_1'    
  2、1、2、3用户的type都给用户4，4基于1、2、3的type创建嵌套类型|  
|  
|  
|
||跟revoke结合测试|grant和revoke的对象一致，循环多次|  
|grant和revoke的对象不一致|  
|
||type在用户1里面的用法|1、用户1使用内置类型做表列，把查询用户1表的权限给2，2可以查询1的表信息，表含内置类型,2、自定义type在用户1作为表列，2有其type的execute权限和查询表、修改、插入的权限，可对无execute权限的udt进行插入修改为null，借助table可以查询udt列，不能直接查询此列（49),2只有其外层的type的权限，直接查外层报错object does not exist or is marked for delete，借助table查询里层，里层仍是无权限的ust，报错是not found（50）,--  没给execute的时候的容错也加上(没给报错not found，给了，我们是不支持物化，是直接查询udt列，借助table函数的查法是允许的,TABLE函数处理后，仍是udt且无权限，仍不可查）,（plsql--给了psql就有权限、pkg里面是用type),  
|  
|  
|  
|
||跟系统级权限|跟EXECUTE ANY TYPE结合|嵌套的适合，一部分对象是execute on给的权限，一部分直接ANY TYPE再去给所有的权限（2个用户的对象，一个execute on，一个any type；一个用户的对象，先any type，再execute on）+回收execute是否还可用，细化如下（41相关用例),1、2个用户的对象，一个execute on，一个any type，回收掉其中一个用户的，不影响另外一个用户的type的使用,2、一个用户的对象，先any type，再execute on不冲突，后面回收掉execute后，可再使用此type,3、一个用户的对象，先execute on，后any type不冲突，后面回收掉any type后，仍然可再使用此type|  
|  
|
|||跟GRANT ANY OBJECT PRIVILEGE结合|（5）2有GRANT ANY OBJECT PRIVILEGE的  权限，可以将1用户的type权限给3，1再给execute给3，若回收1给3的权限，3无法再使用1的type（用例12_1),(6)2有GRANT ANY OBJECT PRIVILEGE的权限，可以将1用户type的grant execute权限给3，1再给execute给3，若回收2给3的权限，3无法再使用1的type（用例12_2),(7)1的type，2把1的type权限给3，2有GRANT ANY OBJECT PRIVILEGE的权限，3用户有2用户给的grant execute权限+1给的grant execute权限，后面回收2的grant ANY OBJECT，仍可使用，无法回收2给的execute权限（用例12_2),(8)有GRANT ANY OBJECT PRIVILEGE系统权限。可以回收owner给的或代表owner用GRANT ANY OBJECT PRIVILEGE授权的。不能回收WITH GRANT OPTION授权的--含下面的测试用例,测试点1：1 2 3 4用户,1的type，2、4有GRANT ANY OBJECT PRIVILEGE系统权限，1将execute给3，2可以回收1给3的（12_4)    
  测试点2：1 2 3 4用户,1的type，2、4有GRANT ANY OBJECT PRIVILEGE系统权限，4将1的execute给3，2可以回收4给1的，1也可以回收4给1的(12_5)    
  测试点3：1 2 3 用户,1的type，2有GRANT ANY OBJECT PRIVILEGE系统权限，1是带WITH GRANT OPTION给3的，2能回收1给3的（有GRANT ANY OBJECT PRIVILEGE系统权限，能回收WITH GRANT OPTION授权的）(  12_6，跟开发资料有出入，后面测试  )|  
|1的type，2有GRANT ANY OBJECT PRIVILEGE若带上WITH GRANT OPTION，无法将1的execute权限给3，报错（用例12_3)|
||跟type本身的AUTHID CURRENT_USER、define的交互|  
|  
|见21|  
|
||跟导入导出|1、  FULL模式下导出下导出元数据，清理相关对象后，full导入，用户2可以使用用户1的type等,2、  用户2把用户1的type作为表列后，这个用户可以导出这张表定义等，可以再导入给用户3，不单独给3用户1的type的execute权限，导入成功，但是登陆3用户，表和plsql不可用（使用了1的type），若给了3权限，登陆3用户，表和plsql可用,3、导出，然后grant被授权的用户被删除，导入只是报错warning,不会因为找不到这个用户而中止,4、    [https://pingcode.yasdb.com/pjm/items/YDBRD-21162](https://pingcode.yasdb.com/pjm/items/YDBRD-21162)      导出内置类型|  
|  
|  
|
||跟审计|给type创建审计，对该type进行grant revoke 操作，会记录审计信息|  
|  
|  
|
||命令执行方式|执行执行，动态执行语句里面执行|  
|  
|  
|
||


（2）  revoke EXECUTE on PersonType from user1;（大部分测试点，公用grant，grant权限后，后面revoke收回，并再验证type不再可用，视图等内容清空）

         dba本身有权限，revoke从dba回收权限

           revoke的时候，type有依赖，被表使用，无法revoke，被type使用可以revoke,但是type不再可用，有其他plsql对象依赖也不影响，只是其他plsql对象不可用

       （type是按照owner做的，切换alter session）

（3）  grant UNDER on PersonType to user1;，大部分测试点同execute，蓝色是不同点。under的revoke同execute，有表依赖，无法回收

|接口|测试分类|有效等价类|备注|无效等价类|备注|
|:---|:---|:---|:---|:---|:---|
|  
  grant UNDER on PersonType to user1;|语法|1、对象或者用户名全小写（引号处理）,2、对象名或用户大小写混合且含中文,3、对象或者用户名长度是64或超过64|  
|1、type对象不存在,2、用户不存在,3、关键字拼写错误,4、不含Not final|  
|
||对象类型-自己创建|  
,1、object,  
,3、多层嵌套,  
,全是自定义的嵌套：,  
,嵌套的都有权限、只有外层有权限、里面public同义词+外层有权限组合（type给了执行权限,pulbic的同义词才可访问）,  
,自定义和内置的嵌套：,  
,4、gis的内置类型  box2d、  GEOMETRY_DUMP、xa的类型,  
,5、对应type的私有同义词，  EXECUTE on 同义词后，type和同义词均可使用/给了type权限，同义词不单独给权限，不可以使用同义词,6、pulic同义词（under_07_1),  
|  
|1、plsql对象,2、  varray、table,3、  record 、  关联数组(tablex)|报错|
||对象类型-其它用户创建|其他用户的type，执行用户对其有权限，去执行grant或revoke,（2）、2是dba用户，可以直接执行grant和revoke，将用户1的type的execute权限给用户3|  
|其他用户的type，对其无权限|  
|
||执行用户|有权限,2、直接创建的用户，alter session操作到创建的用户，创建type，并把权限给其他用户(从dba执行alter session的可以执行grant）,3、拥有内置角色的用户（内置角色的权限不更改情况下）,能创建type的自己创建type+regress给其用户下创建，无法创建的，regress给其用户下创建type,4、拥有内置角色的用户（内置角色权限更改）（废弃21）,比如将create type的权限给内置用户public，然后创建用户（默认用户是pulbic角色），用户创建type并把权限给其他用户，其他角色不测，本身一般不会去改内置角色,5、自定义role，赋予权限，然后role to用户（废弃，角色传递，只能匿名块使用，create type子类型不支持）,6、自定义role，多次级联给其他role，然后其他role to用户，用户再登陆（废弃）,7、自定义role，多次级联给其他role，用户登陆，然后再给role权限，grant或者revoke权限都会有滞后性（废弃）,8、自己给自己成功，自己回收自己报错（type在自己名下）--用例3,自己给自己报错，自己回收自己报错（type不在自己名下，是其他用户grant exeecute给他的）--用例12|  
|无权限,6里面级联中的某一个role被删掉：,drop 中间的某个 role执行后，再登陆执行用户去使用，报错,drop role执行后，原有的执行用户的连接，不重新登陆，若删除的是被执行grant execute的role，立即生效，其他的role，不会生效，仍可继续使用,6里面基本中的某一个role权限被回收，验证是否可用，视图相关字段是否清空,--前面的都废弃,type对象被删，被给权限的用户不可用，视图相关字段是否清空|  
|
||被赋予权限的用户|1、未更改权限的内置角色权限的用户（不需要把所有内置角色都测完，默认的是public，前面其他点已经覆盖，测connect、 resource、 dba）,2、被更改权限的内置角色权限的用户，把用户的type的execute权限给了角色，用户是这个角色，默认就有了这个权限（测个public角色，public可以传递，其他角色均不可传递）,3、有自定义角色权限的用户，无法创建子类型,4、是自定义角色级联权限的用户，无法创建子类型|  
|  
|  
|
||被赋予权限的用户执行的操作|做父类型,可force重建：  重建不带not final或者CURRENT_USER仍可用|  
|drop操作或者alter|报错|
||执行次数|1、将同一对象给同一用户多次（1给2多次，1给2一次，dba把1的给2）,2、将同一对象给多个用户,3、将不同对象（同一用户下的、不同用户下的对象）给同一个用户,4、跨度多个用户，创建嵌套类型：1、1的type给2和3, 2创建嵌套类型type使用了1的type，2再将自己的type权限给3，报错grant option does not exist for 'USER_YDBRD_29538_39_1.OBJ_YDBRD_29538_39_1'    
  2、1、2、3用户的type都给用户4，4基于1、2、3的type创建嵌套类型|  
|  
|  
|
||跟grant结合测试|grant和revoke的对象一致，循环多次|  
|grant和revoke的对象不一致|  
|
||跟系统级权限|  
|嵌套的适合，一部分对象是under on给的权限，一部分直接ANY TYPE再去给所有的权限（2个用户的对象，一个under on，一个under any type；一个用户的对象，先under any type，再under on）|  
|  
|
||跟type本身的AUTHID CURRENT_USER、define的交互|父AUTHID CURRENT_USER|  
|1、  父是AUTHID DEFINE,2、父默认不指定（默认是AUTHID DEFINE）|报错|
||跟导入导出|1、  FULL模式下导出下导出元数据，含grant和revoke命令、含对应type的审计信息,2、  某个用户把其他用户的type作为表列后，这个用户可以导出这张表定义等,3、导出，然后revoke被授权的用户被删除，导入只是报错warning,不会因为找不到这个用户而中止（参考：    [YDBRD-12897](https://jira.yasdb.com/browse/YDBRD-12897?src=confmacro)    -  【CI】grant 被授权的用户不存在，不能终止，应该是warning  解决关闭  ）|  
|  
|  
|
||跟审计|给type创建审计，对该type进行grant revoke under操作，会记录审计信息|  
|  
|  
|
||其他|1用户的type body不创建，2有权限下可以基于1的type创建子类型，仅使用调度1的函数才会报错|  
|  
|  
|
||


### 补充：跟oracle有差异，  ALL PRIVILEGES赋权限后，无法revoke execute单独收回某个权限，oracle可以。

GRANT ALL PRIVILEGES   在yashan其权限相当于execute+revoke，excecute和under的测试点可以直接复用，再特别增加测试点，GRANT ALL PRIVILEGES和execute under是独立的3个命令的测试点。

  


|接口|测试分类|有效等价类|备注|无效等价类|备注|
|:---|:---|:---|:---|:---|:---|
|  
  GRANT ALL PRIVILEGES   |语法|1、对象或者用户名全小写（引号处理）,2、对象名或用户大小写混合且含中文,3、对象或者用户名长度是64或1,4、带上  WITH GRANT OPTION|  
|1、type对象不存在,2、用户不存在,3、关键字拼写错误（不支持的with admin）,  
|  
|
||对象类型：自己创建|1、object（  带或者不带Not final),2、varray、table,3、多层嵌套,全是自定义的嵌套：,嵌套的都有权限、只有外层有权限、里面public同义词+外层有权限组合（type给了执行权限,pulbic的同义词才可访问）,自定义和内置的嵌套：,4、gis的内置类型：  MDSYS.ST_GEOMETRY、MDSYS.BOX2D、MDSYS.GEOMETRY_PATH、MDSYS.GEOMETRY_DUMP、MDSYS.GEOMETRY_DUMP_SET、XA_SYS.DBMS_XA_XID、XA_SYS.DBMS_XA_XID_ARRAY  --普通用户可以使用这些类型+dba用户execute、其他普通用户grant execute,5、对应type的私有同义词，  EXECUTE on 同义词后，type和同义词均可使用/给了type权限，同义词不单独给权限，不可以使用同义词,6、对应type创建public同义词，type不给权限，public同义词不能使用(用例UNDER_07_1)|  
|1、plsql对象,2、匿名块里面的type然后动态语句grant权限,3、pkg里面的type，自身的函数去grant权限，grant pkg.type to user（见20）,4、record 、  关联数组(tablex)|报错|
||对象类型：其它用户创建|其他用户的type，执行用户对其有权限，去执行grant或revoke,（2）、2是dba用户，可以直接执行grant和revoke，将用户1的type的execute权限给用户3（3需要带用户名去使用同义词，无法直接同义词的方式使用）（用例13）,(4)1创建type  ，把权限给2，2后面再把权限给3(1带上WITH GRANT OPTION）--用例12,(8)用户1-2-3，回收1-2的，可以回收，3之前依赖1的type间的表、pkg、func不再可用（表不是直接依赖，1可以从2回收权限）(用例12）,(9)用户1-2-3，回收2-3的，不可以回收，3上面有依赖的表，就是3删了表，2也无法回收（回收站开关影响）  （用例12）|  
|其他用户的type，执行用户对其无权限,（1）、1创建type，把权限给2，2后面再把权限给2和3，2对其有execute权限，去执行grant或revoke报错（2是resource角色无权限、2是pulbie角色也无权限）且2自己给自己grant或者revoke，报错–用例12，不带WITH GRANT OPTION,（3）、1用户的type，用户2有GRANT ANY PRIVILEGE和1用户type的execute权限，是resource角色，执行grant或revoke给3用户，报错（用例14）|  
|
||执行用户|有权限,2、直接创建的用户，alter session操作到创建的用户，创建type，并把权限给其他用户(从dba执行alter session的可以执行grant，不可以revoke；resource用户无法grant）,3、拥有内置角色的用户（内置角色的权限不更改情况下）,能创建type的自己创建type+regress给其用户下创建，无法创建的，regress给其用户下创建type,4、拥有内置角色的用户（内置角色权限更改）,比如将create type的权限给内置用户public，然后创建用户（默认用户是pulbic角色），用户创建type并把权限给其他用户，其他角色不测，本身一般不会去改内置角色,5、自定义role，赋予权限，然后role to用户，用户有权使用，但是无法revoke execute，可以revoke role回收权限，DBA_TAB_PRIVS无记录，DBA_ROLE_PRIVS才有记录,6、自定义role，多次级联给其他role，然后其他role to用户，用户再登陆，可以回收role给用户的权限，无法直接1从2用户回收（1的type的权限是给了role，role给的2用户）,7、自定义role，多次级联给其他role，用户登陆，然后再给role权限，grant或者revoke权限都会有滞后性,8、自己给自己成功，自己回收自己报错（type在自己名下）--用例3,自己给自己报错，自己回收自己报错（type不在自己名下，是其他用户grant execute给他的）–用例12,9、登录用户2无权限，alter session的1用户有权限，不能用1的execute权限（15_3)|内置角色：DBA、AUDIT_ADMIN、SECURITY_ADMIN、SYSDBA、SYSOPER、PUBLIC、CONNECT、RESOURCE、SELECT_CATALOG_ROLE、AUDIT_VIEWER,主要关注DBA、PUBLIC、CONNECT、RESOURCE、SELECT_CATALOG_ROLE,7主要是：  grant role to role是延迟生效的，即如果用户A拥有roleA, 用户登录，此时只有roleA。如果此时grant roleB to roleA, 用户A将不会继承roleB角色。只有当用户A退出再连接，或者另起连接才同时拥有roleA,roleB。|(1)6里面级联中的某一个role被删掉：,drop 中间的某个 role执行后，再登陆执行用户去使用，报错,drop role执行后，原有的执行用户的连接，不重新登陆，若删除的是被执行grant execute的role，立即生效，其他的role，不会生效，仍可继续使用,6里面基本中的某一个role权限被回收，验证是否可用，视图相关字段是否清空,(2)type的所有者进行的操作：,type可force重建（被给权限的用户没有创建依赖type的表,存在依赖的type不影响），type对象被删，被给权限的用户不可用，视图相关字段是否清空（用例28）,执行用户：type不可force重建（被给权限的用户创建依赖type的表）28_1|  
|
||被赋予权限的用户|1、未更改权限的内置角色权限的用户（不需要把所有内置角色都测完，默认的是public，前面其他点已经覆盖，测connect、 resource、 dba）：即使dba，也只能匿名块里面使用(29-31),补充sys用户，无法grant execute to sys（31_1),2、被更改权限的内置角色权限的用户，把用户的type的execute权限给了角色，用户是这个角色，默认就有了这个权限（测个public角色）,3、有自定义角色权限的用户,4、是自定义角色级联权限的用户，回收中间段关联的role的权限，也无权使用|  
|  
|  
|
||被赋予权限的用户执行的操作|直接给用户授权：初始化变量（嵌套的，外层有权限，子给null是可以的，只要不单独调度子类型去构造数据）、做表列（还需要建表和对user表空间的使用权限）、访问其函数、  做嵌套类型的里层,通过role授权：仅匿名块可以使用、  plsql和表列要拦截,可force重建|  
|做父类型,drop操作或者alter|报错|
||执行次数|1、将同一对象给同一用户多次（1给2多次，1给2一次，dba把1的给2）  --我们有差异，也不可以,2、将同一对象给多个用户,3、将不同对象（同一用户下的、不同用户下的对象）给同一个用户,4、跨度多个用户，创建嵌套类型：1、1的type给2和3, 2创建嵌套类型type使用了1的type，2再将自己的type权限给3，报错grant option does not exist for 'USER_YDBRD_29538_39_1.OBJ_YDBRD_29538_39_1'    
  2、1、2、3用户的type都给用户4，4基于1、2、3的type创建嵌套类型|  
|  
|  
|
||跟revoke结合测试|grant和revoke的对象一致，循环多次|  
|grant和revoke的对象不一致|  
|
||type在用户1里面的用法|1、用户1使用内置类型做表列，把查询用户1表的权限给2，2可以查询1的表信息，表含内置类型,2、自定义type在用户1作为表列，2有其type的execute权限和查询表、修改、插入的权限，可对无execute权限的udt进行插入修改为null，借助table可以查询udt列，不能直接查询此列（49),2只有其外层的type的权限，直接查外层报错object does not exist or is marked for delete，借助table查询里层，里层仍是无权限的ust，报错是not found（50）,--  没给execute的时候的容错也加上(没给报错not found，给了，我们是不支持物化，是直接查询udt列，借助table函数的查法是允许的,TABLE函数处理后，仍是udt且无权限，仍不可查）,（plsql--给了psql就有权限、pkg里面是用type),  
|  
|  
|  
|
||跟系统级权限|跟EXECUTE ANY TYPE结合|嵌套的适合，一部分对象是execute on给的权限，一部分直接ANY TYPE再去给所有的权限（2个用户的对象，一个execute on，一个any type；一个用户的对象，先any type，再execute on）+回收execute是否还可用，细化如下（41相关用例),1、2个用户的对象，一个execute on，一个any type，回收掉其中一个用户的，不影响另外一个用户的type的使用,2、一个用户的对象，先any type，再execute on不冲突，后面回收掉execute后，可再使用此type,3、一个用户的对象，先execute on，后any type不冲突，后面回收掉any type后，仍然可再使用此type|  
|  
|
|||跟GRANT ANY OBJECT PRIVILEGE结合|（5）2有GRANT ANY OBJECT PRIVILEGE的  权限，可以将1用户的type权限给3，1再给execute给3，若回收1给3的权限，3无法再使用1的type（用例12_1),(6)2有GRANT ANY OBJECT PRIVILEGE的权限，可以将1用户type的grant execute权限给3，1再给execute给3，若回收2给3的权限，3无法再使用1的type（用例12_2),(7)1的type，2把1的type权限给3，2有GRANT ANY OBJECT PRIVILEGE的权限，3用户有2用户给的grant execute权限+1给的grant execute权限，后面回收2的grant ANY OBJECT，仍可使用，无法回收2给的execute权限（用例12_2),(8)有GRANT ANY OBJECT PRIVILEGE系统权限。可以回收owner给的或代表owner用GRANT ANY OBJECT PRIVILEGE授权的。不能回收WITH GRANT OPTION授权的--含下面的测试用例,测试点1：1 2 3 4用户,1的type，2、4有GRANT ANY OBJECT PRIVILEGE系统权限，1将execute给3，2可以回收1给3的（12_4)    
  测试点2：1 2 3 4用户,1的type，2、4有GRANT ANY OBJECT PRIVILEGE系统权限，4将1的execute给3，2可以回收4给1的，1也可以回收4给1的(12_5)    
  测试点3：1 2 3 用户,1的type，2有GRANT ANY OBJECT PRIVILEGE系统权限，1是带WITH GRANT OPTION给3的，2能回收1给3的（有GRANT ANY OBJECT PRIVILEGE系统权限，能回收WITH GRANT OPTION授权的）(  12_6，跟开发资料有出入，后面测试  )|  
|1的type，2有GRANT ANY OBJECT PRIVILEGE若带上WITH GRANT OPTION，无法将1的execute权限给3，报错（用例12_3)|
||跟type本身的AUTHID CURRENT_USER、define的交互|  
|  
|见21|  
|
||跟导入导出|1、  FULL模式下导出下导出元数据，清理相关对象后，full导入，用户2可以使用用户1的type等,2、  用户2把用户1的type作为表列后，这个用户可以导出这张表定义等，可以再导入给用户3，不单独给3用户1的type的execute权限，导入成功，但是登陆3用户，表和plsql不可用（使用了1的type），若给了3权限，登陆3用户，表和plsql可用,3、导出，然后grant被授权的用户被删除，导入只是报错warning,不会因为找不到这个用户而中止,4、    [https://pingcode.yasdb.com/pjm/items/YDBRD-21162](https://pingcode.yasdb.com/pjm/items/YDBRD-21162)      导出内置类型|  
|  
|  
|
||跟审计|给type创建审计，对该type进行grant revoke 操作，会记录审计信息|  
|  
|  
|
||命令执行方式|执行执行，动态执行语句里面执行|  
|  
|  
|
||测试3个权限是独立的|3个权限都给，依次回收under execute ALL PRIVILEGES,只有最后回收了ALL PRIVILEGES后，2用户才不可使用1用户的type,给ALL PRIVILEGES权限,后面回收是execute under报错，2用户仍可使用1用户的type,给execute权限,后面回收是ALL PRIVILEGES报错，2用户仍可使用1用户的type,给execute+under权限,后面回收是ALL PRIVILEGES报错，2用户仍可使用1用户的type,用户1有两个type，一个给all PRIVILEGES ,一个给execute，用户2使用这两个type，回收execute后，用户2的type无法使用|  
|  
|  
|
||


### 3.2.2 涉及的测试DFX

|系统级DFX分类|是否涉及|
|:---|:---|
|CT 并发测试|是|
|DFR|/|
|HA|/|
|KT kill测试|是|
|一致性|/|
|三方测试工具    
  (sqltest，sqlancer)|/|
|压力|/|
|可维护性|/|
|安全|/|
|性能|/|
|长稳|/|


（3）集群：不单独再设计测试点，上面的用例，挑选用例，同一用例，不同步骤，放置在不同的实例下执行

（4）并发+testkill设计

         前置相关对象，1执行grant并去使用，2执行revoke并验证无法使用（用户1直接把自己的type权限给用户2）

之前复杂相关性的用例基础上，把授权和回收加进去（影响数据字典有效性等）

         被type依赖的，revoke后，加并发



# 4.  **测试用例**

# 5.  **测试框架设计**

本次测试使用guider框架，一致性框架、testkill框架和ha框架  实现

# 6.   **测试环境说明**

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|  
|


# **7. 工作量评估**

工作量：X  *人天*

计划测试完成时间：