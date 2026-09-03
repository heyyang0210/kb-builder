Created by 郝鑫刚, last modified on 七月 25, 2023

  [YDBRD-13628](https://jira.yasdb.com/browse/YDBRD-13628?src=confmacro)    -  集群支持JOB  完成

  


##   [1. Overview（概述）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#1-overview%E6%A6%82%E8%BF%B0)  

DBMS_JOB、DBMS_SCHEDULER的功能适配在集群下正常使用。

（不包括DBMS_IJOB高级包）

1）DBMS_JOB、DBMS_SCHEDULER 的JOB默认是随机在任意实例上执行。

2）DBMS_JOB、DBMS_SCHEDULER 的JOB可以指定在某一实例上执行。

3）DBMS_JOB、DBMS_SCHEDULER的函数并发在集群下无core。

  


新增DBMS_JOB.INSTANCE接口

##   [2. Features（功能特性）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#2-features%E5%8A%9F%E8%83%BD%E7%89%B9%E6%80%A7)  

必选：说明本方案的功能特性。有等价类的正交划分形式，给出功能特性设计出来的规格全貌。

  


|功能|  
|  
|
|:---|:---|:---|
|DBMS_JOB,(函数需要commit才能生效)|SUBMIT、BROKEN、CHANGE、INTERVAL、NEXT_DATE、RUN、WHAT、REMOVE,新增INSTANCE接口。,  
|默认下，指定的关联实例不运行时报错。,SUBMIT的instance指定job的关联实例。默认或输入NULL为任意实例，值是0。,SUBMIT的force参数为TRUE时可以创建指定的instance没有运行的job。,CHANGE的instance修改job的关联实例。默认不修改。NULL为不修改。,CHANGE的force参数为TRUE时可以创建指定的instance没有运行的job。,RUN的force参数为TRUE时可以在当前实例执行其它实例的job。,INSTANCE的instance为NULL会改为0。|
|DBMS_SCHEDULER|CREATE_JOB、DISABLE、DROP_JOB、ENABLE、SET_ATTRIBUTE、|CREATE_JOB创建时不能指定实例。默认任意实例。,SET_ATTRIBUTE的instance_id只能指定正在运行的实例。,RUN_JOB只能执行当前实例的job。|
|JOB执行|  
|  
|
|v$instance|INSTANCE_NUMBER|值改为从1开始，单机是1。 （原来是0）|
|userenv(' ')|'INSTANCE' |值从1开始，单机是1。 （原来是0）|
|AWR使用|sys.dbms_awr.awr_report|l_inst_num字段使用时改为从1开始(原来会给0)|


```
## INSTANCE

```plsql
DBMS_JOB.INSTANCE(
	job IN BIGINT,
	instance IN INTEGER,
	force IN BOOLEAN DEFAULT FALSE);
```

INSTANCE程序用于设置定时任务关联的实列。

| 参数 | 用途                                                         |
| :--- | :----------------------------------------------------------- |
| job  | 定时任务的对象ID，可以通过DBA_JOBS/ALL_JOBS/USER_JOBS视图查询。 |
| instance  | 定时任务在集群环境下执行的实例。 |
| force     | 为FALSE时，设置的instance必须是正在运行的。为TRUE时，任意整数的instance都可以创建。 |

示例

```plsql
EXEC DBMS_JOB.INSTANCE(1681, 1);
COMMIT;

EXEC DBMS_JOB.INSTANCE(1681, 9, TRUE);
COMMIT;
```
```

  


查看：

DBA_JOBS.  INSTANCE  、DBA_SCHEDULER_JOBS.  INSTANCE_ID  查看设置的实例号。

可以通过select INSTANCE_NUMBER from v$instance; 查看集群下实例的编号。

  


DBMS_JOB包指定实例执行：

DBMS_JOB.SUBMIT()的instance参数指定实例的编号。

DBMS_JOB.CHANGE()修改instance参数。

  


DBMS_JOB.INSTANCE() 新增接口

  


  


  


```
create table rac_job_t1(seq int, INST_ID number, name varchar2(24), host_ip  varchar2(255), run_date TIMESTAMP );
create sequence job_rac_seq1;

DECLARE 
X NUMBER; 
begin 
SYS.DBMS_JOB.SUBMIT(X, 'begin insert into rac_job_t1  SELECT job_rac_seq1.nextval, v.INSTANCE_NUMBER, ''job2'', v.DATA_HOME, sysdate FROM  V$INSTANCE v; commit; end;', 
				SYSDATE, 'SYSDATE + 1/(24 * 60 * 6)', FALSE, 2); 
COMMIT; 
END; 
/

exec DBMS_JOB.INSTANCE(1842, 3);
commit;

exec DBMS_JOB.INSTANCE(1842, 9, true);
commit;

drop sequence job_rac_seq1;
drop table rac_job_t1;
```

  


  


DBMS_SCHEDULER包：

exec dbms_scheduler.create_job('TEST_JOB' ,   );

exec dbms_scheduler.set_attribute( 'TEST_JOB' , 'INSTANCE_ID', 1');

```
begin
 dbms_scheduler.create_job('rac_job_s2', 'PLSQL_BLOCK', 'begin insert into rac_job_t1  SELECT job_rac_seq1.nextval, v.INSTANCE_NUMBER, ''scheduler1'', v.DATA_HOME, sysdate FROM  V$INSTANCE v; commit; end;', 
				0, NULL, 'SYSDATE + 1/(24 * 60 * 3)', null, 'DEFAULT_JOB_CLASS', true);
end;
/

exec dbms_scheduler.SET_ATTRIBUTE('rac_job_s2', 'instance_id', 2);
```

  


  


  


  


##   [3. Interfaces（接口）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#3-interfaces%E6%8E%A5%E5%8F%A3)  

列出本方案对外提供的接口、配置参数、API等。

  


  


##   [4. Specification And Constraints（规格与约束）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#4-specification-and-constraints%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

说明本方案对外的功能规格或约束。

  


本次无新增功能，只是适配DBMS_JOB、DBMS_SCHEDULER的原有功能在集群多实例下的使用。

  


##   [5. Detail Design（详细设计）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#5-detail-design%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)  

方案设计的详细说明，包括但不限于方案选型、方案所依赖的技术/第三方组件的原理或背景介绍、关键技术点、方案折衷的考量、可靠性分析、兼容性分析。可以根据需要增删小节。

**必选项1：关键技术点说明，设计方案要契合代码原有架构，涉及架构整改的工作，必须详细方案展开，同时评估好对其他特性的影响。**

**必选项2：第三方组件，组件的开源协议，引入后可能带来的影响。不允许未经过DRB评审的第三方组件合入。**

**必选项3：SR的特性设计需要跨模块配合，要拆解出来AR列表。**

###   [5.1 Architecture（架构）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#51-architecture%E6%9E%B6%E6%9E%84)  

job的流程：

1）创建job时将job的信息写入SYS.SCHEDULER$_JOB系统表中。

2）后台线程定期扫描一次SYS.SCHEDULER$_JOB，根据NEXT_RUN_DATE字段找到需要执行的job。

3）判断JOB的状态，对需要执行的job启动一个线程执行。在执行前后更新SYS.SCHEDULER$_JOB表，设置JOB的状态。

  


适配：

- job没有内存结构，操作都是以系统表为准。所以不需要做额外的消息同步和并发控制。
- 创建job时把instance信息写入系统表。
- 扫描系统表后，检查INSTANCE_ID和当前实例是否匹配，跳过不匹配的job。


  


  


###   [5.2 Data Structures & Flow（数据结构与流程）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#52-data-structures--flow%E6%95%B0%E6%8D%AE%E7%BB%93%E6%9E%84%E4%B8%8E%E6%B5%81%E7%A8%8B)  

设计主要数据结构、工作流程、时序图等。

**与协议、通讯、多线程多进程同步、涉及多个模块互相配合的功能特性设计，必须需要给出时序图（为了跨模块分解AR和定义模块间接口，可参考**  ** **    [https://www.jianshu.com/p/282d57f09692](https://www.jianshu.com/p/282d57f09692)    ** **  **）。**

**给出功能特性的工作流程图（体现功能特性内部工作流程，可参考**  ** **    [https://zhuanlan.zhihu.com/p/112731728](https://zhuanlan.zhihu.com/p/112731728)    ** **  **）。用于支撑测试方案的灰盒测试。**

  


没有新增的消息。

###   [5.3 Compatibility（兼容性）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#53-compatibility%E5%85%BC%E5%AE%B9%E6%80%A7)  

说明设计方案对兼容性的影响，如果影响了兼容性，则需要给出详细的兼容性方案设计。

**在涉及对已交付版本的系统表、系统视图、系统包等特性做修改时，要参照版本兼容性要求文档，给出兼容性设计。**

  


**之前版本的job都是可以在任意实例上执行。**

###   [5.4 DFX设计](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#54-dfx%E8%AE%BE%E8%AE%A1)  

按特性的种类可选，涉及安全、性能、可靠、可维、可测；

1.协议、驱动、访问控制、通讯、加密等特性需求，要考虑安全；

2.执行表达式和算子类的特性需求，需要考虑性能；

3.主备、容灾、存储等的特性需求，需要考虑可靠性；

4.所有特性均需要考虑可维、可测。

###   [5.5 其他](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#55-%E5%85%B6%E4%BB%96)  

根据特性开发的种类，有不同的涉及相关项, 如下示例，不同的特性种类关心范围有所差异，需要根据特性种类来扩展：

**涉及数据库语法开发，需要考虑系统权限和系统审计。**

**涉及数据库对象的特性开发，需要考虑对象级权限、对象级审计、对象安全访问和主备同步实现。**

##   [6. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#6-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

1. 创建实例1执行的job，在job的动作中包含instance的信息，检查确实在实例1上执行。
1. 验证以上dbms_job、dbms_schedual包的函数并发无core。


##   [7.资料设计章节](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#7%E8%B5%84%E6%96%99%E8%AE%BE%E8%AE%A1%E7%AB%A0%E8%8A%82)  

1.  DBMS_JOB

2.DBMS_SCHEDULER

##   [8. TODO（遗留问题）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#8-todo%E9%81%97%E7%95%99%E9%97%AE%E9%A2%98)  

*说明本方案遗留的问题或下一步需要解决的问题。*

## Attachments:

[image2023-5-15_11-40-55.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiNTA4OTcwYzJhZjRmNTIwMzljIiwicmVmX2lkIjoiNjczOTZiNGY1OTNmOTljOWZmMjM2MGI2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkyOTU5LCJleHAiOjE3ODIzNzkzNTl9.-NYZrZgS6d692pE-bZair3GLe85tqSg7L4oShSDvsYE)

 (image/png)    


[image2023-5-14_12-0-23.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiNTBhMWFkOWEzMzExZGM4MjEzIiwicmVmX2lkIjoiNjczOTZiNGY1OTNmOTljOWZmMjM2MGI2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkyOTU5LCJleHAiOjE3ODIzNzkzNTl9.Ewm-iBt9ShM_lJQW91OjzEFBqqBZ1Lv0542tEa51EcU)

 (image/png)    


[image2023-5-14_11-58-32.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiNTA4OTcwYzJhZjRmNTIwMzllIiwicmVmX2lkIjoiNjczOTZiNGY1OTNmOTljOWZmMjM2MGI2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkyOTU5LCJleHAiOjE3ODIzNzkzNTl9.gK-9TDlQjYvsvOWMDfU93T6gzhhHz_kQZPjoOZildI0)

 (image/png)    


[image2023-5-10_16-10-26.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiNTA4OTcwYzJhZjRmNTIwM2EwIiwicmVmX2lkIjoiNjczOTZiNGY1OTNmOTljOWZmMjM2MGI2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkyOTU5LCJleHAiOjE3ODIzNzkzNTl9.TNmTez8mf4lzfIzBtmArAa-sQqMz7s5C3aT7qrKvWRs)

 (image/png)    
