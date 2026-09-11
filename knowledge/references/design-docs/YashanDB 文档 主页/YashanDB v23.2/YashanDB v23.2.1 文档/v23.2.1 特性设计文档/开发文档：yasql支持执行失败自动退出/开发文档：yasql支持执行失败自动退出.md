Created by 刘亮杰, last modified on 十二月 12, 2023

# yasql支持执行失败自动退出

SR：

  [YDBRD-22291](https://jira.yasdb.com/browse/YDBRD-22291?src=confmacro)    -  【yasql】选项支持设置报错退出  完成

  


##   [1. Overview（概述）](https://conf.yasdb.com/pages/viewpage.action?pageId=127635843#1-overview%E6%A6%82%E8%BF%B0)  

需求来源：  长亮科技

需求范围：  单机  ,   分布式  ,   集群

需求描述：yasql当前默认执行失败，报错但未退出。    
  如果类比Oracle的功能，我们的实施经验是进到sqlplus命令行后，设置以下参数    
  whenever sqlerror exit sql.sqlcode;    
  可以让sql执行报错后立即报错退出。    
    
  使用场景：    
  部分业务通过yasql执行一批sql，希望中间失败就报错退出，不往下执行后续的sql。

##   [2. Features（功能特性）](https://conf.yasdb.com/pages/viewpage.action?pageId=127635843#2-features%E5%8A%9F%E8%83%BD%E7%89%B9%E6%80%A7)  

yasql支持执行失败自动退出

  [WHENEVER SQLERROR (oracle.com)](https://docs.oracle.com/en/database/oracle/oracle-database/23/sqpug/WHENEVER-SQLERROR.html#GUID-66C1C12C-5E95-4440-A37B-7CCE7E33491C)  

  [3. Interfaces（接口）](https://conf.yasdb.com/pages/viewpage.action?pageId=127635843#3-interfaces%E6%8E%A5%E5%8F%A3)  

WHENEVER SQLERROR {EXIT [SUCCESS | FAILURE | WARNING | n | variable | :BindVariable] [COMMIT | ROLLBACK]}

其中EXIT [SUCCESS | FAILURE | WARNING | n | variable | :BindVariable] [COMMIT | ROLLBACK]语法与EXIT完全一致

```

-- 基本用法：在出现错误时退出
WHENEVER SQLERROR EXIT FAILURE;
 
-- 使用不同的退出代码(通过终端看echo $?)
WHENEVER SQLERROR EXIT SUCCESS;  -- 在错误时以成功状态退出
WHENEVER SQLERROR EXIT WARNING;  -- 在错误时以警告状态退出
WHENEVER SQLERROR EXIT 10;       -- 在错误时以自定义状态码10退出

-- 结合事务控制
WHENEVER SQLERROR EXIT FAILURE ROLLBACK;  -- 在错误时回滚并退出
WHENEVER SQLERROR EXIT SUCCESS COMMIT;    -- 在错误时提交并退出



```

  [4. Specification And Constraints（规格与约束）](https://conf.yasdb.com/pages/viewpage.action?pageId=127635843#4-specification-and-constraints%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

不支持continue

  


变量重名 变量来源于指定变量或者环境变量

  


##   [5. Detail Design（详细设计）](https://conf.yasdb.com/pages/viewpage.action?pageId=127635843#5-detail-design%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)  

  


```
static CodVoid asqlProcessLocalCommand(CodText* args)
//增加解析whenever命令
switch (gCmdEnv.cmdId) {
	case ASQL_CMD_WHENEVER:
            asqlWhenever();
            break;
}
}
//原方案：直接设置buf
void asqlWhenError()
{
gCmdEnv.Whenever=   COD_TRUE;

}
//execute后验证是否error
void asqlExec(CodText sql)
{
if(gCmdEnv.Whenever=   COD_TRUE)
{
gCmdEnv.isClosed = COD_TRUE;
    asqlDisconnect();
}

//现方案：共用exit逻辑，修改asqlExit()
asqlExit()；

```

##   [6. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=127635843#6-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

```


```

##   [7.资料设计章节](https://conf.yasdb.com/pages/viewpage.action?pageId=127635843#7%E8%B5%84%E6%96%99%E8%AE%BE%E8%AE%A1%E7%AB%A0%E8%8A%82)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [8. TODO（遗留问题）](https://conf.yasdb.com/pages/viewpage.action?pageId=127635843#8-todo%E9%81%97%E7%95%99%E9%97%AE%E9%A2%98)  

  


  


## Comments:

|  [](null)  ,1.oserror(找解决方案 需求范围 yasql执行shell）,2.是否驱动错误都是sqlerror(待验证）改包,3.完善参数规格调研 参数歧义（优先级）define或者环境变量组合测试 参数默认值,4.exit,  
,Posted by liuliangjie at 十二月 12, 2023 11:17|
|---|
