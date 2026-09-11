Created by 未知用户 (liaofeng) on 一月 19, 2024

##   [1. Overview（概述）](#1-overview概述)  

  [oracle文档](https://docs.oracle.com/en/database/oracle/oracle-database/19/arpls/OWA_UTIL.html#GUID-7915F61E-1E50-4507-87FC-7E0ECAE3D41D)  

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


oracle实现

```
create procedure who_called_me( owner      out varchar2,
                         name       out varchar2,
                         lineno     out number,
                         caller_t   out varchar2 )
as
    call_stack  varchar2(4096) default dbms_utility.format_call_stack;
    n           number;
    found_stack BOOLEAN default FALSE;
    line        varchar2(255);
    t           varchar2(255);
    cnt         number := 0;
begin
--
    loop
        n := instr( call_stack, NL_CHAR );
        exit when ( cnt = 3 or n is NULL or n = 0 );
--
        line := ltrim(substr( call_stack, 1, n-1 ));
        call_stack := substr( call_stack, n+1 );
--
        if ( NOT found_stack ) then
            if ( line like '%handle%number%name%' ) then
                found_stack := TRUE;
            end if;
        else
            cnt := cnt + 1;
            -- cnt = 1 is ME
            -- cnt = 2 is MY Caller
            -- cnt = 3 is Their Caller
            if ( cnt = 3 ) then
		-- Fix 718865
                --lineno := to_number(substr( line, 13, 6 ));
                --line   := substr( line, 21 );
		n := instr(line, ' ');
		if (n &gt; 0)
		then
		    t := ltrim(substr(line, n));
		    n := instr(t, ' ');
		end if;
		if (n &gt; 0)
		then
		   lineno := to_number(substr(t, 1, n - 1));
		   line := ltrim(substr(t, n));
		else
		    lineno := 0;
		end if;
                if ( line like 'pr%' ) then
                    n := length( 'procedure ' );
                elsif ( line like 'fun%' ) then
                    n := length( 'function ' );
                elsif ( line like 'package body%' ) then
                    n := length( 'package body ' );
                elsif ( line like 'pack%' ) then
                    n := length( 'package ' );
                    elsif ( line like 'anon%' ) then
                        n := length( 'anonymous block ' );
                    else
                        n:=0;
                    end if;

                    if (n = 0) then
                        -- could be a trigger or a type body
                        caller_t := ltrim(rtrim(upper(substr(line, n+1))));
                    else
                        caller_t := ltrim(rtrim(upper(substr(line,1,n-1))));
                    end if;

                line := substr( line, n );
                n := instr( line, '.' );
                owner := ltrim(rtrim(substr( line, 1, n-1 )));
                name  := ltrim(rtrim(substr( line, n+1 )));
            end if;
        end if;
    end loop;
end;

```