Created by 同二鹏, last modified on 十二月 28, 2023

## 1. Overview（概述）

集群多实例部署下，执行大部分DDL时，需要广播其他实例做元数据同步。元数据同步处于DDL事务提交之后，如果事务提交后，元数据未同步全部实例，此实例故障，导致集群元数据不一致，后续会发生不可预知的问题。实例故障后，db master实例做故障恢复时，需要将所有活跃实例的元数据修正。

## 2. Features（功能特性）

某DB实例故障后，master实例会触发故障恢复，故障恢复要能够处理元数据不一致的问题。故障恢复结束后，所有DB实例的元数据保持一致。

## 3. Interfaces（接口）

## 4. Limitations（功能限制）

## 5. Detail Design（详细设计）

1.逻辑日志和事务结束日志一起记录，随后其他实例同步元数据的修改。记录逻辑日志时需要暂停ckpt推点，防止元数据未全部同步，但是日志回放起始点已经推至逻辑日志之后。记录逻辑日志的地方主要集中在ddl第二阶段，还有部分场景分散在其他地方。前者可以统一处理暂停推点，后者需要在各业务场景自己暂停。

2.因为存在上述规则约束，所以，记录从逻辑日志到同步元数据的整个阶段变为不可并发的状态。实例故障时，最多只会存在一条逻辑日志需要处理。

3.逻辑日志回放的处理过程中，可能涉及读取系统表页面，因此需要在物理日志回放结束后进行。

4.   在线恢复是通过故障实例日志使得全局数据和元数据达到一致性状态。现存的逻辑日志场景部分需要重新设计，以适应集群的回放逻辑。

|场景|类型|修改|回放逻辑|
|---|---|---|---|
|创建、修改、删除profile|LOGT_CREATE_PROFILE、LOGT_ALTER_PROFILE、LOGT_DROP_PROFILE|1.LOGT_CREATE_PROFILE、  LOGT_DROP_PROFILE需要记录profile的ctime,2.profile系统表增加ctime列|1. create profile，如果对应的slot已经存在，结束处理，否则，查找系统表是否存在相同ctime，相同id的记录，如果存在，加载至内存，否则，结束处理。
1. alter profile，load系统表
1. drop profile，如果对应的slot没有被使用，直接返回，否则，检查ctime是否一致，如果一致，删除，否则，结束处理。
|
|创建、删除ROLE|LOGT_CREATE_ROLE、LOGT_DROP_ROLE|1.LOGT_CREATE_ROLE、LOGT_DROP_ROLE需要记录role的ctime|1.create role，如果对应的slot已经存在，结束处理，否则，查找系统表是否存在相应记录，如果存在，加载至内存，否则，结束处理。,2. drop role，如果对应的slot没有被使用，结束处理，否则，检查ctime是否一致，如果一致，删除，否则，结束处理。|
|授权、撤权|LOGT_GRANT_SYS_PRIV、LOGT_GRANT_ROLE、LOGT_GRANT_OBJ_PRIV、LOGT_GRANT_SYS_PRIV、LOGT_GRANT_OBJ_PRIV、LOGT_GRANT_ROLE、LOGT_REVOKE_SYS_PRIV、LOGT_REVOKE_OBJ_PRIV、LOGT_REVOKE_ROLE、LOGT_REVOKE_SYS_PRIV、LOGT_REVOKE_OBJ_PRIV、LOGT_REVOKE_ROLE|1.相关逻辑日志需要记录user或者role的ctime|以grant_sys_priv为例作说明，其他类似,1.grant_sys_priv，判断对应ctime的role或者user是否存在，通过系统表确认权限记录是否存在，如果都通过校验，才能回放处理,  
,  
|
|创建、删除、修改SO|LOGT_CREATE_SO、LOGT_DROP_SO、LOGT_ALTER_SO|  
|1.创建对象，检查entry是否存在，不存在的话校验obj$是否存在，如果存在，创建对象DictEntry。,2.删除对象，检查entry是否存在，存在的话，删除,3.修改对象，检查对象entry是否存在，如果存在，执行失效逻辑|
|创建、删除、修改表、视图、同义词|LOGT_CREATE_TABLE、LOGT_DROP_TABLE、LOGT_ALTER_TABLE、LOGT_RENAME_TABLE|  
|1.创建对象，检查entry是否已经存在，不存在的话校验obj$是否存在，如果存在，创建对象DictEntry。,2.删除对象，检查entry是否存在，存在的话，删除,3.修改对象，检查对象entry是否存在，如果存在，执行失效逻辑|
|创建、删除、修改trigger|LOGT_CREATE_TRIGGER、LOGT_DROP_TRIGGER、LOGT_ALTER_TRIGGER|  
|1.创建对象，检查entry是否已经存在，不存在的话校验obj$是否存在，如果存在，创建对象DictEntry。,2.删除对象，检查entry是否存在，存在的话，删除,3.修改对象，检查对象entry是否存在，如果存在，执行失效逻辑|
|创建、删除、修改TYPE|LOGT_CREATE_TYPE、LOGT_ALTER_TYPE、LOGT_DROP_TYPE|  
|1.创建对象，检查entry是否已经存在，不存在的话校验obj$是否存在，如果存在，创建对象DictEntry。,2.删除对象，检查entry是否存在，存在的话，删除,3.修改对象，检查对象entry是否存在，如果存在，执行失效逻辑|
|审计策略生效，失效、修改|LOGT_AUDIT_POLICY、LOGT_NOAUDIT_POLICY、LOGT_ALTER_AUDIT_POLICY、LOGT_ALTER_AUDIT_INVALID_TABLE、LOGT_AUDIT_USER、LOGT_NOAUDIT_USER、LOGT_NOAUDIT_FINAL、LOGT_AUDIT_CHANGE_ROLE_PRIV、LOGT_AUDIT_DROP_ROLE|  
|  
|
|创建、删除、修改用户|LOGT_CREATE_USER、LOGT_DROP_USER、LOGT_ALTER_USER|1.LOGT_CREATE_USER、LOGT_DROP_USER需要记录用户的创建时间|1.create user，如果对应的slot已经存在，结束处理，否则，查找系统表是否存在相应记录，如果存在，加载至内存，否则，结束处理。,2. drop user，如果对应的slot没有被使用，结束处理，否则，检查ctime是否一致，如果一致，删除，否则，结束处理。,3. alter user，reload系统表|
|创建、删除、修改sequence|LOGT_CREATE_SEQ、LOGT_DROP_SEQ|1.alter sequence需要补充日志LOGT_ALTER_SEQ|1.创建对象，检查entry是否已经存在，不存在的话校验obj$是否存在，如果存在，创建对象DictEntry。,2.删除对象，检查entry是否存在，存在的话，删除,3.修改对象，检查对象entry是否存在，如果存在，执行失效逻辑|
|interval分区扩展|LOGT_ALTER_TABLE|增加LOGT_INTERVAL_EXTEND|1.查找表是否存在,2.检查分区是否已经扩展,3.符合条件执行扩展逻辑|
|统计信息|LOGT_ALTER_TABLE|增加LOGT_STATS_CHANGE,  
|统计信息逻辑日志忽略处理|
|创建segment|  
|增加LOGT_CREATE_SEGMENT|  
|


6. 逻辑日志存在依赖性，回放的顺序是靠日志的lsn的大小关系。为了保证多实例下存在依赖的逻辑日志的lsn保序，需要在相应的同步逻辑里lamport lsn。

7. 逻辑日志过滤，除了interval分区扩展之外，其他的逻辑日志都是持有相应对象的全局X锁进行，GRC资源恢复后，故障实例的owner信息已经清除，如果是需要回放的逻辑日志的场景，对应的锁资源一定没有持有X的owner，否则，就跳过此逻辑日志。

## 6. Testcases（用例）

## 7. Workload（工作量）

1. 评估代码量KLOC = xxx行
1. 评估工作量 =xxx（人天）


## 8. TODO（遗留问题）



  


## Attachments:

[remaster.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiNGM4OTcwYzJhZjRmNTIwMzZkIiwicmVmX2lkIjoiNjczOTZiNGM1OTNmOTljOWZmMjM2MDk0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkyODAyLCJleHAiOjE3ODIzNzkyMDJ9.L4s6naBZjoUxk_UNw657UgR-CmnWKPqquvG1uhesSM0)

 (image/png)    
