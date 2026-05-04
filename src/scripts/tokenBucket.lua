local key=KEYS[1]
local capacity=tonumber(ARGV[1])
local refillRate=tonumber(ARGV[2])
local now= tonumber(ARGV[3])
local ttl=tonumber(ARGV[4])

local data= redis.call('GET',key)

local tokens
local lastRefill

if data then 

    -- Key exists — parse the stored JSON-like string
    -- We store as "tokens:timestamp" format (simpler than JSON in Lua)
    local sep=string.find(data, ':')
    tokens=tonumber(string.sub(data,1,sep-1))
    lastRefill=tonumber(string.sub(data,sep+1))
else
    tokens=capacity
    lastRefill=now
end

--calculate token refill based on time passed
local timePassed=now-lastRefill
local tokensTOAdd=timePassed*refillRate

tokens=math.min(capacity,tokens+tokensTOAdd)

lastRefill=now

local allowed=0
if tokens>=1 then
    tokens=tokens-1
    allowed=1
end

--store updated bucket to redis
local newData= tostring(tokens)..':'..tostring(lastRefill)
redis.call('SETEX',key,ttl,newData)

--redis lua arrays map to node.js arrays
return {allowed,tostring(tokens),tostring(capacity)}