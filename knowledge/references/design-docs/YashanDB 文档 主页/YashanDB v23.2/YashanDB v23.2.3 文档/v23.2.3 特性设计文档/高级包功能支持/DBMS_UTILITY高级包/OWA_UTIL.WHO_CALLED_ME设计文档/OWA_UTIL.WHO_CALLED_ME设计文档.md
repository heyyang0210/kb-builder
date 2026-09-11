Created by 未知用户 (liaofeng) on 一月 19, 2024

##   [1. Overview（概述）](#1-overview概述)  

OWA_UTIL.WHO_CALL_ME通过output参数返回该子过程的调用者的信息，包括owner，name，lineno，caller_t

##   [2. Features（功能特性）](#2-features功能特性)  

###   [语法](#语法)  

```
OWA_UTIL.WHO_CALLED_ME(
&nbsp;&nbsp;&nbsp;owner&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;OUT&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;VARCHAR2,
&nbsp;&nbsp;&nbsp;name&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;OUT&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;VARCHAR2,
&nbsp;&nbsp;&nbsp;lineno&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;OUT&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;NUMBER,
&nbsp;&nbsp;&nbsp;caller_t&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;OUT&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;VARCHAR2);

```

###   [参数](#参数)  

|Parameter|Description|
|---|---|
|  `owner`  |调用者过程体的owner|
|  `name`  |调用者过程体的名字。如果是package的子程序，则返回package的名字；如果是procedure或function，则返回对应的名称；如果调用者是anonymous，则返回NULL|
|  `lineno`  |调用者的行号|
|  `caller_t`  |调用者的类型。 package body, anonymous block, procedure, and function.|


##   [3. Interfaces（接口）](#3-interfaces接口)  

##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

1. 该内置package是由plsql创建的，属于sys用户的高级包，通过PUBLIC SYNONYM使其他用户直接识别。执行package需要有execute any procedure权限
1. 在sys用户可以drop，replace OWA_UTIL高级包（oracle内置高级包大多可以，不要轻易尝试，需要重建库才能找回）
1. 其他用户可以创建自己用户的OWA_UTIL高级包，在使用时会优先查找自己用户下的高级包


##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

```
CREATE OR REPLACE PACKAGE OWA_UTIL AUTHID CURRENT_USER
AS
    PROCEDURE WHO_CALLED_ME(OWNER OUT VARCHAR2, NAME OUT VARCHAR2, LINENO OUT NUMBER, CALLER_T OUT VARCHAR2);
END;
/

CREATE OR REPLACE PACKAGE BODY OWA_UTIL
AS
    PROCEDURE WHO_CALLED_ME(OWNER OUT VARCHAR2, NAME OUT VARCHAR2, LINENO OUT NUMBER, CALLER_T OUT VARCHAR2)
    AS
    CALL_STACK  VARCHAR2(4096) DEFAULT DBMS_UTILITY.FORMAT_CALL_STACK;
    N           NUMBER;
    FOUND_STACK BOOLEAN DEFAULT FALSE;
    LINE        VARCHAR2(255);
    T           VARCHAR2(255);
    CNT         NUMBER := 0;
    NL_CHAR     VARCHAR(255) DEFAULT CHR(10);
    BEGIN
        LOOP
            N := INSTR(CALL_STACK, NL_CHAR);
            EXIT WHEN (CNT = 3 OR N IS NULL OR N = 0);

            LINE := TRIM(SUBSTR(CALL_STACK, 1, N-1));
            CALL_STACK := SUBSTR(CALL_STACK, N+1);

            IF (NOT FOUND_STACK) THEN            
                IF (LINE LIKE '%handle%number%name%') THEN
                    FOUND_STACK := TRUE;
                END IF;
            ELSE
                CNT := CNT + 1;
                -- cnt = 1 is ME
                -- cnt = 2 is MY Caller
                -- cnt = 3 is Their Caller
                IF (CNT = 3) THEN
                    N := INSTR(LINE, ' ');
                    IF (N &gt; 0)
                    THEN
                        T := TRIM(SUBSTR(LINE, N));
                        N := INSTR(T, ' ');
                    END IF;

                    IF (N &gt; 0)
                    THEN
                    LINENO := TO_NUMBER(SUBSTR(T, 1, N - 1));
                    LINE := TRIM(SUBSTR(T, N));
                    ELSE
                        LINENO := 0;
                    END IF;

                    IF (LINE LIKE 'pr%') THEN
                        N := LENGTH('procedure ');
                    ELSIF (LINE LIKE 'fun%') THEN
                        N := LENGTH('function ');
                    ELSIF (LINE LIKE 'package body%') THEN
                        N := LENGTH('package body ');
                    ELSIF (LINE LIKE 'pack%') THEN
                        N := LENGTH('package ');
                    ELSIF (LINE LIKE 'anon%') THEN
                        N := LENGTH('anonymous block ');
                    ELSE
                        N := 0;
                    END IF;

                    IF (N = 0) THEN
                        CALLER_T := LTRIM(RTRIM(UPPER(SUBSTR(LINE, N+1))));
                    ELSE
                        CALLER_T := LTRIM(RTRIM(UPPER(SUBSTR(LINE,1,N-1))));
                    END IF;

                    LINE := SUBSTR(LINE, N);
                    N := INSTR(LINE, '.');
                    OWNER := TRIM(SUBSTR(LINE, 1, N-1));
                    NAME  := TRIM(SUBSTR(LINE, N+1));
                END IF;
            END IF;
        END LOOP;
END;
END;
/



CREATE OR REPLACE PUBLIC SYNONYM OWA_UTIL FOR SYS.OWA_UTIL
/


```

###   [5.1 Architecture（架构）](#51-architecture架构)  

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

设计开发人员自测用例（文字描述），给出开发者自测试的设计方案表格或者XMIND、开发自测的用例归档路径。

1. 正常场景覆盖，anonymous, procedure，function，package body
1. 嵌套package head，动态sql，execute immediate，cursor，job，udt，trigger
1. 异常场景，buf不足，权限，同名高级包
1. 多层嵌套


##   [7.资料设计章节](#7资料设计章节)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [8. TODO（遗留问题）](#8-todo遗留问题)  

*说明本方案遗留的问题或下一步需要解决的问题。*