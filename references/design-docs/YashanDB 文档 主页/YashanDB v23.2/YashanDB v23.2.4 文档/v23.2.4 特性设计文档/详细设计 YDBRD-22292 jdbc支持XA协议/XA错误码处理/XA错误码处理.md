Created by 张周玺, last modified on 三月 26, 2024

##   
  XA标准规定的错误码    


|xa code|xa code|xaCode的含义|中文含义|
|---|---|---|---|
|XAER_OUTSIDE|-9|The resource manager is doing work outside global transaction.|资源管理器正在全局事务之外执行工作。|
|XAER_DUPID|-8|The XID already exists.|XID已存在。|
|XAER_RMFAIL|-7|Resource manager is unavailable.|资源管理器不可用。|
|XAER_PROTO|-6|Routine was invoked in an inproper context|例程是在不正确的上下文中调用的|
|XAER_INVAL|-5|Invalid arguments were given.|给出了无效的参数。|
|XAER_NOTA|-4|The XID is not valid.|XID无效。|
|XAER_RMERR|-3|A resource manager error has occured in the transaction branch.|事务分支中发生资源管理器错误。|
|XAER_ASYNC|-2|Asynchronous operation already outstanding.|异步操作已完成。|
|XA_RDONLY|3|The transaction branch has been read-only and has been committed.|事务分支是只读的，并且已提交。|
|XA_RETRY|4|Routine returned with no effect and may be reissued.|返回的例程无效，可以重新发布。|
|XA_HEURMIX|5|The transaction branch has been heuristically committed and rolled back.|事务分支已试探性地提交并回滚。|
|XA_HEURRB|6|The transaction branch has been heuristically rolled back.|事务分支已试探性地回滚。|
|XA_HEURCOM|7|The transaction branch has been heuristically committed.|已试探性地提交事务分支。|
|XA_HEURHAZ|8|The transaction branch may have been heuristically completed|事务分支可能已启发式完成|
|XA_NOMIGRATE|9|Resumption must occur where suspension occured|发生暂停时必须恢复|
|XA_RBROLLBACK|100|the rollback was caused by an unspecified reason|回滚是由未指明的原因引起的。|
|XA_RBCOMMFAIL|101|Rollback was caused by communication failure|回滚是由通信故障引起的|
|XA_RBDEADLOCK|102|A deadlock was detected.|检测到死锁。|
|XA_RBINTEGRITY|103|A condition that violates the integrity of the resource was detected.|检测到违反资源完整性的情况。|
|XA_RBOTHER|104|The resource manager rolled back the transaction branch for a reason not on this list.|资源管理器回滚了事务分支，原因不在此列表中。|
|XA_RBPROTO|105|A protocol error occured in the resource manager.|资源管理器中出现协议错误。|
|XA_RBTIMEOUT|106  :|A transaction branch took too long.|事务分支花费的时间太长。|
|XA_RBTRANSIENT|107|The inclusive upper bound of the rollback error code.|可以重试事务分支|


## 崖山错误码和xa 错误码的对应关系

|崖山错误码|错误信息详情|备注 |xa code|xa code|xaCode的含义|
|---|---|---|---|---|---|
|2101|###   YAS-02101:ERR_ANK_XA_TOO_MANY_PARTICIPAT    
    
  **  Message  **  ：  too many local sessions participating in global transaction    
    
  **  Action  **  ：内部错误，请联系我们的技术支持解决。|  
|  
|  
|  
|
|2102|###   YAS-02102:ERR_ANK_XA_PREPARED_NOT_FOUND    
    
  **  Message  **  ：  no prepared transaction found with ID % PRIu64    
    
  **  Action  **  ：指定  GTID  的分布式事务未找到，查询  v$2pc_pending  视图。|  
|XAER_PROTO|-6|Routine was invoked in an inproper context|
|2103|###   YAS-02103:ERR_ANK_XA_BRANCH_INPROGRESS    
    
  **  Message  **  ：  distributed transaction branch already attached    
    
  **  Action  **  ：内部错误，请联系我们的技术支持解决。|  
|XAER_RMFAIL|-7|Resource manager is unavailable.|
|2105|###   YAS-02105:ERR_ANK_XA_ALREADY_EXIST    
    
  **  Message  **  ：  distributed transaction branch with ID % PRIu64 already exists    
    
  **  Action  **  ：内部错误，请联系我们的技术支持解决。|  
|XAER_DUPID|-8|The XID already exists.|
|2106|###   YAS-02106:ERR_ANK_XA_STATUS    
    
  **  Message  **  ：  distributed transaction status error, expect %s    
    
  **  Action  **  ：分布式事务状态非法，查询  v$2pc_pending  视图确认分布式事务状态。|  
|  
|  
,不涉及|  
|
|2114|###   YAS-02114:ERR_ANK_XA_INVALID_GTID    
    
  **  Message  **  ：  invalid or incorrectly formatted GTID    
    
  **  Action  **  ：指定分布式  GTID  错误，更正后重试。|  
|XAER_NOTA|-4|The XID is not valid.|
|2116|###   YAS-02116:ERR_ANK_XA_FORBID_AUTON    
    
  **  Message  **  ：  forbid phase1 in autonomous transaction    
    
  **  Action  **  ：自治事务无法转换为分布式事务，等待或重试。|  
|XAER_OUTSIDE|-9|The resource manager is doing work outside global transaction.|
|2126|###   YAS-02126:ERR_ANK_XA_FORBID_FORCE_COMMIT    
    
  **  Message  **  ：  specified distributed transaction should be force commit without scn    
    
  **  Action  **  ：内部错误，请联系我们的技术支持解决。|  
|  
|不涉及|  
|
|2168|###   YAS-02168:ERR_ANK_XA_FORBID_TEMPORARY    
    
  **  Message  **  ：  forbid 2-phase when involving temporary tables    
    
  **  Action  **  ：不能对临时表执行分布式事务，请检查  SQL  所在环境。|  
|XAER_OUTSIDE|-9|The resource manager is doing work outside global transaction.|
|2660|###   YAS-02660:ERR_ANK_XA_TOO_MANY_SLICE    
    
  **  Message  **  ：  too many slices in distributed transaction    
    
  **  Action  **  ：请减少在分布式事务中生成  slice  的数量。|  
|  
|不涉及|  
|
|2715|###   YAS-02715:ERR_ANK_XA_DUPLICATED_GTID    
    
  **  Message  **  ：  XA: duplicate transaction identifier    
    
  **  Action  **  ：请检查  GTID  是否重复。|  
|XAER_DUPID|-8|The XID already exists.|
|2716|###   YAS-02716:ERR_ANK_XA_INVALID_FLAG    
    
  **  Message  **  ：  XA: invalid flag    
    
  **  Action  **  ：请使用正确的  flag  。    
|  
|XAER_INVAL|-5|Invalid arguments were given.|
|2717|YAS-02717:ERR_ANK_XA_NO_CURRENT    
    
  **  Message  **  ：  XA: no current xa transaction    
    
  **  Action  **  ：确保本连接上  XA  事务存在。|  
|XAER_RMFAIL|-7|Resource manager is unavailable.|
|2718|###   YAS-02718:ERR_ANK_XA_GTID_NOT_EXIST    
    
  **  Message  **  ：  XA: transaction with specified identifier does not exist    
    
  **  Action  **  ：确保指定  GTID  存在。|  
|XAER_NOTA|-4|The XID is not valid.|


  


  
    


  


  
