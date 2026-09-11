Created by 王博文, last modified on 八月 08, 2023

# 1、Overview（概述）

  [YDBRD-15260](https://jira.yasdb.com/browse/YDBRD-15260?src=confmacro)    -  支持session级别的commit nowait参数  完成

本评审文档，支持为 commit 语句增加 session 级别的 NOWAIT 参数。

  [调试 commit 语句](https://conf.yasdb.com/pages/viewpage.action?pageId=119561974)  

# 2、Features（功能特性）

- 支持使用 SQL 语句 
- 修改 session 级参数 COMMIT_WAIT 为 WAIT 或 NOWAIT
- 


```
alter session set commit_wait = nowait;
alter session set commit_wait = wait;
```

# 3、Interfaces（接口）

- SQL 语句


# 4、Specification And Constraints（规格与约束）

- 已存在系统级参数 COMMIT_WAIT，将其扩展为会话级参数
- 当前支持修改的参数值为 WAIT、NOWAIT，其余均报错
- 每次仅修改当前会话的该参数值，重新连接后失效


# 5、Detail Design（详细设计）

### 5.1 VARLEN_SES_PARAM_DEF

- 由于参数值可为 WAIT、NOWAIT、FORCE_WAIT，故为 VARLEN_PARAM，而非 NORMAL_PARAM 的布尔值


### 5.2 anlSetSesWaitLevel()

- 由 AnkHandler → SesParamCtx，设置会话中上下文参数
- 传入 CodText 需为 XcommitWait 枚举中的元素，进行校验，此处仅支持 WAIT、NOWAIT，其余报错
- 调用 ankSetSesWaitLevel()
- 加锁后给 sesParamCtx 赋值，完成后解锁返回


### 5.3 ankSetSesWaitLevel()

- 由 AnkHandler → Xrm，给事务 xcommitWait 属性赋值
- 给 handler → attr 属性赋值


### 5.4 anrParamAsStr()

- COD_CALL(anrParamAsStr(PARAM_COMMIT_NOWAIT, attr->xcommitWait, ANL_SES_PARAM_NORMAL_SIZE));


### 5.5 attr → sesParam

-    COD_CALL(codStrCopy(attr->xcommitWait, sesParamCtx->xwaitLevelstr, ANL_SES_PARAM_NORMAL_SIZE));
- codStr2Text(sesParamCtx->xwaitLevelstr, &sesParamCtx→xwaiLevel);


### 5.6 rdCommit

- 增加 return 条件：需判断系统参数部位 FORCE_WAIT


# 6、Testcases（自测用例）



```
sql1：
> create table temp(id int, name varchar(10));
> insert into temp values(1,'a');
> commit;

sql2：
> alter session set commit_wait = nowait;
> insert into temp values(2,'b');
> commit;

gdb：
> b rdCommit 
> 观察即可
```

  




1、参数默认为 WAIT，修改会话级参数值 > alter session set commit_wait = nowait；查看 > show parameter commit_wait，得到 NOWAIT；修改系统级参数值 > alter system set commit_wait = nowait scope = spfile;

2、重启 yasdb，查看 > show parameter commit_wait，得到 NOWAIT，系统参数修改成功；再次修改会话参数 > alter session set commit_wait = wait；查看 > show parameter commit_wait，得到 WAIT；另启 yasql，查看 > show parameter commit_wait，得到 NOWAIT；

3、修改系统参数 > alter system set commit_wait = force_wait scope = spfile;重启yasdb，查看 > show parameter commit_wait，得到 FORCE_WAIT；修改会话参数 > alter session set commit_wait = nowait；使用 gdb 调试，实际效果为 WAIT，证明系统参数值 FORCE_WAIT 优先级高于会话参数值；

4、系统参数仍为 FORCE_WAIT，使用 SQL 语句 > commit write immediate nowait;gdb 调试，实际效果为 WAIT；

5、系统级为 WAIT、会话级为 NOWAIT 时，实际效果为 NOWAIT。